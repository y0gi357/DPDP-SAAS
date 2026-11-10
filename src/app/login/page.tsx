import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { safeNext } from "@/lib/tokens";

const NOTES: Record<string, string> = {
  expired: "Your password changed, so please sign in again.",
  access: "You no longer have access to that organisation. Sign in again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string; next?: string; invited?: string }> }) {
  const { error, reset, next, invited } = await searchParams;
  const target = safeNext(next);

  async function login(formData: FormData) {
    "use server";
    const to = safeNext(String(formData.get("next") ?? ""));
    try {
      await signIn("credentials", { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? ""), redirect: false });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/login?error=1&next=${encodeURIComponent(to)}`);
      throw e;
    }
    redirect(to);
  }

  return (
    <div className="auth">
      <h1>Sign in</h1>
      <p className="muted">DPDPA Compliance Platform</p>
      {reset && <div style={{ color: "var(--ok)", marginBottom: 10 }}>Password changed. Sign in with the new one.</div>}
      {invited && <div className="notice">Sign in with the account for the invited email address to continue.</div>}
      {error && NOTES[error] && <div className="notice">{NOTES[error]}</div>}
      <form action={login} className="card">
        <input type="hidden" name="next" value={target} />
        <input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
        {error === "1" && <div className="err">Invalid email or password, or too many attempts. Wait a few minutes and try again.</div>}
        <button type="submit">Sign in</button>
        <Link href="/forgot-password" className="muted" style={{ fontSize: 13 }}>Forgot your password?</Link>
      </form>
      {process.env.ALLOW_SIGNUP !== "false" && <p className="muted">New organisation? <Link href="/register">Create an account</Link></p>}
    </div>
  );
}
