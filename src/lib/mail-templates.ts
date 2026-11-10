import { ROLE_LABELS, type RoleName } from "./team";

const sign = "\n\n-- DPDPA Platform";

export const verifyEmailMail = (name: string, link: string) => ({
  subject: "Confirm your email address",
  text: `Hello ${name},\n\nConfirm your email address to finish setting up your account:\n${link}\n\nThe link works for 48 hours. If you did not create an account, ignore this message.${sign}`,
});

export const resetPasswordMail = (name: string, link: string) => ({
  subject: "Reset your password",
  text: `Hello ${name},\n\nUse this link to choose a new password:\n${link}\n\nThe link works for one hour and can be used once. If you did not ask for this, ignore this message; your password stays as it is.${sign}`,
});

export const invitationMail = (a: { orgName: string; inviter: string; role: RoleName; link: string }) => ({
  subject: `${a.inviter} invited you to ${a.orgName} on the DPDPA Platform`,
  text: `${a.inviter} invited you to join ${a.orgName} as ${ROLE_LABELS[a.role]}.\n\nAccept the invitation:\n${a.link}\n\nThe link works for 7 days. If you were not expecting this, ignore this message.${sign}`,
});
