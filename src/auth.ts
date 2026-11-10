import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { hit, ipFrom } from "@/lib/ratelimit";

const creds = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

// Compared against when the account does not exist, so response time does not reveal which emails are registered.
let dummy: string | undefined;
const dummyHash = () => (dummy ??= bcrypt.hashSync("not-a-real-password", 12));

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      async authorize(raw, request) {
        const parsed = creds.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        const [byEmail, byIp] = await Promise.all([hit(`login:e:${email}`, 10, 900), hit(`login:i:${ipFrom(request.headers)}`, 40, 900)]);
        if (!byEmail.ok || !byIp.ok) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || (user.lockedUntil && user.lockedUntil > new Date())) { await bcrypt.compare(parsed.data.password, dummyHash()); return null; }

        if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
          const fails = user.failedLogins + 1;
          await prisma.user.update({ where: { id: user.id }, data: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLogins: fails } });
          return null;
        }
        if (user.failedLogins || user.lockedUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });

        // The first organisation becomes active; people can switch from the sidebar.
        const m = await withTenant({ userId: user.id }, (tx) => tx.membership.findFirst({ where: { userId: user.id }, orderBy: { id: "asc" } }));
        if (!m) return null;
        return { id: user.id, email: user.email, name: user.name, orgId: m.orgId, role: m.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = user.id;
        token.orgId = user.orgId;
        token.role = user.role;
        token.issuedAt = Math.floor(Date.now() / 1000);
      }
      // Switching organisation: only to one the person actually belongs to.
      if (trigger === "update" && token.uid && typeof session?.orgId === "string") {
        const uid = token.uid;
        const m = await withTenant({ userId: uid }, (tx) => tx.membership.findFirst({ where: { userId: uid, orgId: session.orgId } }));
        if (m) { token.orgId = m.orgId; token.role = m.role; }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid ?? "";
      session.user.orgId = token.orgId ?? "";
      session.user.role = token.role ?? "AUDITOR";
      session.user.issuedAt = token.issuedAt ?? 0;
      return session;
    },
  },
});
