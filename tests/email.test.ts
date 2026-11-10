import assert from "node:assert/strict";
import mailer from "smtp-mailer";
import { sendEmail } from "../src/lib/email";

// Use the real patched mailer's JSON transport; never connect to an SMTP server.
const originalCreateTransport = mailer.createTransport;
const originalSmtp = process.env.SMTP_URL;
const originalFrom = process.env.EMAIL_FROM;
const jsonTransport = originalCreateTransport({ jsonTransport: true });
let captured: Record<string, unknown> = {};
let defaults: unknown;
mailer.createTransport = ((_transport: unknown, configuredDefaults: unknown) => {
  defaults = configuredDefaults;
  return {
    async sendMail(message: Parameters<typeof jsonTransport.sendMail>[0]) {
      const result = await jsonTransport.sendMail(message);
      captured = JSON.parse(String(result.message));
      return result;
    },
  };
}) as typeof originalCreateTransport;

async function run() {
  try {
    process.env.SMTP_URL = "smtp://localhost:2525";
    process.env.EMAIL_FROM = "Privacy <privacy@example.test>";
    const result = await sendEmail({ to: "customer@example.test", subject: "Consent portal test", text: "Manage your privacy choices using the private link in your real email." });
    assert.equal(result.delivered, true);
    assert.equal(captured.subject, "Consent portal test");
    assert.ok(JSON.stringify(captured.to).includes("customer@example.test"));
    assert.ok(JSON.stringify(captured.from).includes("privacy@example.test"));
    assert.equal(captured.text, "Manage your privacy choices using the private link in your real email.");
    assert.deepEqual(defaults, { disableFileAccess: true, disableUrlAccess: true });
    console.log("Patched SMTP mailer compatibility check passed using JSON transport (no email sent).");
  } finally {
    mailer.createTransport = originalCreateTransport;
    if (originalSmtp === undefined) delete process.env.SMTP_URL; else process.env.SMTP_URL = originalSmtp;
    if (originalFrom === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = originalFrom;
  }
}
run().catch((e) => { console.error(e); process.exitCode = 1; });
