import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: { id: string; orgId: string; role: string; issuedAt: number } & DefaultSession["user"];
  }
  interface User {
    orgId?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    orgId?: string;
    role?: string;
    issuedAt?: number;
  }
}
