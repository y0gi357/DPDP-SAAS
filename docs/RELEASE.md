# Community release checklist

Preparation is not a declaration that these checks have passed.

- [ ] Confirm ownership/permissions for first-party code and control-library content; review third-party obligations.
- [ ] Confirm Apache-2.0 licence and community scope. Public recipients retain the licence rights to this release.
- [ ] Scan all Git history, branches and release artifacts for secrets and private data; rotate any exposed credentials.
- [ ] Install from a clean checkout with npm ci and a disposable PostgreSQL database.
- [ ] Generate Prisma client, deploy all migrations, apply RLS and seed the library.
- [ ] Run typecheck, consent/email tests, consent isolation and production build; record commands, versions and results.
- [ ] Review dependency audit findings and third-party licences; resolve or document material issues.
- [ ] Rehearse registration, invitations, password reset, roles, cross-tenant boundaries, portal expiry/withdrawal and PDF/DOCX reports.
- [ ] Test backup and restore on disposable data; review upgrade/migration recovery.
- [ ] Have the legal library reviewed, or keep draft labels visible in demonstration and documentation.
- [ ] Enable GitHub private vulnerability reporting; review collaborators, branch protections and security notifications.
- [ ] Attach only fictional screenshots/reports; provide a demo recording and known limitations.
- [ ] Create an annotated release tag and GitHub release only after checks; describe it as an evaluation release.

No repository visibility change, published GitHub release or completed production certification is implied by this checklist.
