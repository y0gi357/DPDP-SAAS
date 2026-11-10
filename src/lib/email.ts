import nodemailer, { type Transporter } from "smtp-mailer";

export type Mail = { to: string; subject: string; text: string };

export const emailConfigured = () => !!process.env.SMTP_URL;
export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

let transport: Transporter | undefined;

/**
 * Sends through SMTP when SMTP_URL is set (any provider: SES, Resend, Postmark, your own server).
 * Without it, development prints the message to the console; production prints only a notice,
 * because the message holds a live link.
 */
export async function sendEmail(m: Mail): Promise<{ delivered: boolean }> {
  if (!process.env.SMTP_URL) {
    if (process.env.NODE_ENV !== "production") console.log(`\n[email not configured] To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n`);
    else console.error(`[email not configured] could not send "${m.subject}"; set SMTP_URL`);
    return { delivered: false };
  }
  transport ??= nodemailer.createTransport(process.env.SMTP_URL, { disableFileAccess: true, disableUrlAccess: true });
  await transport.sendMail({ from: process.env.EMAIL_FROM ?? "DPDPA Platform <no-reply@localhost>", to: m.to, subject: m.subject, text: m.text });
  return { delivered: true };
}
