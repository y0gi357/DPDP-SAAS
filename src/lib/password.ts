// Password policy, shared by sign-up, invitation, reset and change-password.
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "qwerty", "qwerty123", "123456789", "1234567890", "letmein", "welcome", "welcome1",
  "admin", "administrator", "iloveyou", "monkey", "dragon", "abc123", "changeme", "p@ssw0rd", "india123", "dpdpa", "secret",
]);

export const MIN_LENGTH = 12;

/** Returns a message if the password is not acceptable, otherwise null. */
export function validatePassword(pw: string, ctx: { email?: string; name?: string } = {}): string | null {
  if (pw.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  if (pw.length > 128) return "Use at most 128 characters.";
  const lower = pw.toLowerCase();
  const stripped = lower.replace(/[^a-z0-9]/g, "");
  if (COMMON.has(lower) || [...COMMON].some((c) => c.length >= 6 && stripped.startsWith(c.replace(/[^a-z0-9]/g, "")))) return "That password is too common.";
  if (/^(.)\1+$/.test(pw)) return "Do not repeat a single character.";
  if (new Set(pw).size < 5) return "Use a wider mix of characters.";
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Do not include your email name in the password.";
  const first = ctx.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (first && first.length >= 4 && lower.includes(first)) return "Do not include your name in the password.";
  return null;
}
