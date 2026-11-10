# DPDPA Compliance Platform — Community Edition

A multi-tenant DPDP implementation and assessment application built with Next.js, React, TypeScript, Prisma, PostgreSQL and Auth.js. The community edition is an early evaluation release for self-hosted assessment and audit-evidence workflows. The legal control library remains a draft; this is not a production-readiness or legal-compliance certification.

## Community release resources

- [Contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md)
- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Fictional demonstration walkthrough](docs/DEMO.md)
- [Release checklist](docs/RELEASE.md), [local validation results](docs/VALIDATION.md) and [changelog](CHANGELOG.md)

## Current features

- Organisation profiles, steering committees, departments and SPOCs
- Application/data-source inventory, vendors and sub-processors
- RoPA, risk screening, DPIA review/approval and controls assessments
- Gap detection and remediation, breach register and data-flow diagrams
- Versioned consent notices, customer decisions and private customer portal
- Consent Manager fiduciary-readiness checklist and manual processor withdrawal follow-up
- Dashboards, implementation roadmap, PDF/DOCX reports and CSV exports
- Password authentication, role-based access, invitations, email verification, password reset and organisation switching
- PostgreSQL row-level security for tenant data and an append-only application audit log

## Local setup

Use Node.js 22 and a reachable PostgreSQL instance (the supplied Compose setup uses PostgreSQL 16). Run these commands from the project directory on a new checkout:

```bash
cp .env.example .env
# Generate a value with openssl rand -base64 32 and put it in AUTH_SECRET.
# Review DATABASE_URL, DIRECT_URL, APP_URL and mail settings in .env.
npm ci
npx prisma generate
docker compose up -d db
npx prisma migrate deploy
npm run db:rls
npm run db:seed
npm run test:consent
npm run test:isolation
npm run test:consent-isolation
npm run dev
```

Open http://localhost:3000 and register your first organisation. Use fictional data for evaluation. Verify the account using the development-server email link, or configure SMTP. No default administrator account is shipped. On Windows, use WSL2 for these shell commands. The Compose service supplies the database only; Node.js runs the application.

Open http://localhost:3000. After initial setup, check types with `npm run typecheck`; check the production build with `npm run build`. SMTP is optional for local development: when absent, email links are printed to the development server console. Set SMTP for production email delivery.

The supplied database credentials are local-development defaults, also shown in `.env.example`. Change them for hosted deployments and bind PostgreSQL only to the interfaces you intend to expose. Docker's initialisation SQL runs only for a fresh database volume; existing volumes retain their roles/passwords.

`npm run db:migrate` creates development migrations and re-applies RLS. For an existing environment, deploy committed migrations with `npx prisma migrate deploy`, followed by `npm run db:rls`. The default seed selects `v1.1-draft`; it is active only after a successful seed run. First-time activation of a new library version starts a fresh assessment view.

## Database access

| Connection | Purpose |
|---|---|
| `DATABASE_URL` / `app_user` | Running app; restricted role subject to tenant RLS |
| `DIRECT_URL` / `dpdpa_owner` | Migrations, security setup and control-library imports |

Do not run the app with a superuser or a role that bypasses RLS. Tenant queries must run inside `withTenant()` so the database receives transaction-local organisation/user context.

When adding a tenant table, add an `orgId` index, enable and force RLS in `prisma/rls.sql`, use `withTenant()`, and add database isolation coverage. The consent-specific isolation test rolls back its fixtures; the original general isolation test creates persistent test organisations and should run only on a development/test database.

## Scope and limitations

The controls are draft content for qualified legal review, including applicability and commencement dates. This software does not establish legal compliance or Board registration as a Consent Manager. Consent withdrawal follow-up is manual. MFA, SSO, billing, automatic processor notifications, guardian verification and a production retention/deletion workflow are not implemented. Library upgrades that must preserve the current assessment view require assessment carry-forward by control code.

## Uploading to GitHub

Commit the source, all Prisma migrations, `prisma/rls.sql`, control-library JSON files, tests, `package.json`, `package-lock.json` and `.env.example`. Exclude `.env` and other local environment files, private keys, database dumps, logs, uploads, `node_modules` and `.next`; the project `.gitignore` covers these common paths. Inspect staged files before pushing. If a secret was ever committed, removing the file or adding an ignore rule does not remove it from history.

First-party project code is licensed under [Apache-2.0](LICENSE). Third-party dependencies retain their own licences. See [third-party review](docs/THIRD_PARTY.md). Apache-2.0 permits commercial use under its terms; this public version remains available under those terms even if later development becomes private. No paid edition or enterprise-only module is implemented by this release preparation.

## Business consent management

The **Consent records** sidebar entry (`/consent/records`) adds operational consent management alongside the existing notice draft and readiness checklist. It is software for a business managing its customers' choices; it does not establish Board registration as a Consent Manager.

Setup after pulling these changes:

```bash
# Start the configured PostgreSQL service first.
npx prisma migrate deploy
npm run db:rls
npx prisma generate
npm run test:consent
npm run test:consent-isolation
npm run dev
```

Set `APP_URL`, `SMTP_URL` and `EMAIL_FROM` using `.env.example`. Portal access uses a random 256-bit bearer link, stored only as a SHA-256 hash, expiring after 24 hours. A replacement link invalidates the previous one. Production sends links only through SMTP; development may print or display the link for testing. Protect application/proxy access logs, since URLs contain credentials. Privacy pages suppress referrers, caching and search indexing. Anyone holding a valid link can act for that customer; higher assurance deployments should replace this with their authenticated customer identity system.

Workflow:

1. An owner/admin publishes a purpose, its data items, language, full notice, and systems/processors needing withdrawal follow-up. Each published notice is an immutable version. Use a new purpose key for a different processing purpose; use a new version for revised wording within that purpose. Review notices before publishing.
2. A contributor/admin adds a customer email/reference and sends a private portal link. Customers can also request access at `/privacy/<orgId>`; responses do not disclose whether an email is enrolled.
3. The customer reads the notice and explicitly grants or declines each purpose. Nothing is preselected, and staff cannot enter consent on their behalf. Grants on older versions are identified as such, and do not cover a newer notice. Stale submissions are rejected. The original grant can still be withdrawn after a new version is published or the purpose is paused.
4. Withdrawal records an immutable decision and creates a manual follow-up task for each configured system, including targets preserved in notices previously granted by that customer. Staff acknowledge each task with the action taken or lawful retention exception. **No external webhook or processor notification is sent and no remote processing is stopped automatically.** Configure systems before requesting consent and monitor this queue operationally. A later grant never cancels outstanding withdrawal tasks.
5. Customers can review their history and download JSON containing their decisions, exact notice versions and follow-up status. Staff can search customers and inspect their history. Aggregate evidence appears in Controls Assessment, Dashboard and PDF/DOCX reports; it does not automatically mark a control implemented.

Permissions follow the existing roles: OWNER/ADMIN publish/pause purposes; OWNER/ADMIN/SPOC enrol customers, issue/revoke links and acknowledge follow-up; AUDITOR is read-only. All five new tables use forced tenant RLS and composite foreign keys that include `orgId`. The app database role cannot update/delete published notices or decision events. Updates are audited.

There is no automatic deletion job or blanket seven-year retention rule in this business module. Set and document the organisation's evidence-retention policy before production and implement a reviewed owner-controlled purge process as needed. Published versions and events are retained until then. Language codes label the supplied wording; the app does not translate notices. This version does not implement guardian verification, registered Consent Manager interoperability, external consent-capture APIs, webhooks or billing.

Validation commands: `npm run typecheck`, `npm run test:consent`, `npm run test:consent-isolation`. The database test uses the restricted `DATABASE_URL`, covers cross-tenant reads/writes and relationships, immutable history, expired/revoked portal access, and rolls back its fixtures.


### Consent Manager fiduciary readiness checklist

Open **Notice & Consent → Consent management** (`/consent?tab=cmp`). Three additional items assess receiving consent/withdrawal instructions through a Consent Manager, checking its Board registration, and passing withdrawals to relevant processors. The older overall CM-integration answer remains separate; it is not treated as an answer to the new items.

Record the CM legal name and registration reference, official listing/source URL, check date/reviewer and evidence; integration owner, consent/withdrawal channels and test results; processor routing owner, channels, acknowledgement/escalation process, internal timescale, lawful-processing exception procedure and test evidence. An **In place** answer requires the matching evidence fields, while **Not applicable** requires an explanation. Partial/unanswered items may be saved while evidence is gathered. Dates must be valid and no later than the current UTC date; source links must be HTTP(S) without embedded credentials. Use document/case references rather than secrets or customer data.

Readiness evidence is stored in the existing tenant-scoped `ConsentConfig.cmp` JSON and preserved with the checklist in the append-only audit log on save. This checklist addition requires no new migration. It appears on matching fiduciary controls and in PDF/DOCX report evidence; answers do not automatically implement a control. The platform does not independently check the Board register, call CM endpoints or dispatch processor notifications. If several CMs/processors are involved, include the complete set and supporting document references in the evidence notes.

References: DPDP Act, Sec 6(6), 6(7), 6(9) and Sec 8(2); [official DPDP Rules, 2025, Rule 4](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf). Registration and integration remain staff assessments, not an assertion of independent verification. The earlier business-consent migration is still required for the customer portal and withdrawal queue.


### Active library for testing

`npm run db:seed` now selects `data/controls-v1.1.json` by default (override with `CONTROLS_FILE`). A successful seed run activates `v1.1-draft`. The first activation creates fresh controls/assessments for that version; earlier versions and their assessments remain stored. Re-running the seed for an already loaded label reactivates that existing version without duplicating controls. This fresh assessment view was accepted for testing; production upgrades that need continuity should carry assessments forward by control code.


### Dependency recovery after a forced audit fix

The app uses the Auth.js v5 API. `next-auth@1.x` cannot provide `next-auth/providers/credentials`, `auth`, `handlers` or the server-side sign-in API. `next-auth` is pinned to `5.0.0-beta.32` to retain the existing implementation, and Zod is pinned to `4.6.7`.

SMTP emails use the official Nodemailer `10.4.0` package under the npm alias `smtp-mailer`. This isolates the app's SMTP dependency from Auth.js v5's optional Nodemailer peer range (v7/v8). Auth.js is configured only with Credentials and does not use its optional email provider. Do not add its Nodemailer provider without checking compatibility with the supported patched mailer. Nodemailer 10 supplies its own types, so the older `@types/nodemailer` dependency is removed. File and URL attachment access are disabled in the SMTP transport defaults.

When deliberately changing dependencies, stop the development server and run `npm install` to reconcile `package-lock.json`. The committed lockfile has been regenerated; use `npm ci` for a fresh checkout. Then run `npm run typecheck`, `npm run test:consent`, `npm run test:email`, `npm run build` and `npm audit`, and restart the development server. The email regression check uses a JSON transport and sends no real email; invitation, reset and consent-link delivery should also be exercised with your configured SMTP service. Commit the regenerated lockfile along with `package.json` and the source changes.
