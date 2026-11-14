# DPDPA Compliance Platform — Community Edition

A multi-tenant DPDP implementation and assessment application built with Next.js, React, TypeScript, Prisma, PostgreSQL and Auth.js. The community edition is an early evaluation release for self-hosted assessment and audit-evidence workflows. The legal control library remains a draft; this is not a production-readiness or legal-compliance certification.

<img width="1327" height="772" alt="Screenshot 2026-11-12 015550" src="https://github.com/user-attachments/assets/71bcb804-9f25-4dc2-9251-a7857470c34d" />


## Documentation

- [Contributing](CONTRIBUTING.md) and [security reporting](SECURITY.md)
- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Fictional demonstration walkthrough](docs/DEMO.md)
- [Departments, sub-functions and SPOCs](docs/DEPARTMENTS.md)
- [Consent workflow and permissions](docs/CONSENT.md)
- [Control-library and dependency maintenance](docs/MAINTENANCE.md)
- [Validation results and known check failures](docs/VALIDATION.md
- [Maintainer release checklist](docs/RELEASE.md) and [changelog](CHANGELOG.md)

## Walkthrough of Anumati


## Current features

- Organisation profiles, steering committees, departments, sub-functions and multiple SPOCs
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
npm run dev
```

Open http://localhost:3000 and register your first organisation. Use fictional data for evaluation. Verify the account using the development-server email link, or configure SMTP. No default administrator account is shipped. On Windows, use WSL2 for these shell commands. The Compose service supplies the database only; Node.js runs the application.

SMTP is optional for local development: when absent, email links are printed to the development server console. Configure SMTP before production email delivery.

The supplied database credentials are local-development defaults, also shown in `.env.example`. Change them for hosted deployments and bind PostgreSQL only to the interfaces you intend to expose. Docker's initialisation SQL runs only for a fresh database volume; existing volumes retain their roles/passwords.

`npm run db:migrate` creates development migrations and re-applies RLS. For an existing environment, deploy committed migrations with `npx prisma migrate deploy`, followed by `npm run db:rls`. The default seed selects `v1.1-draft`; it is active only after a successful seed run. First-time activation of a new library version starts a fresh assessment view.

### Access from another device on the local network

Run `npm run dev -- --hostname 0.0.0.0` and browse to the host's network address, for example `http://192.168.1.6:3000`. The development origin allowlist includes that address. If the host IP changes, add `DEV_ALLOWED_ORIGINS="your-new-ip"` to `.env` (hostnames/IPs only, comma-separated, without a scheme or port), then restart the development server and reload the browser. Blocked development assets can leave a page visible while JavaScript controls do not respond.

Use the network address as `APP_URL` when email links must open on other devices. Sign in separately on the network address; localhost and LAN hosts do not share cookies. This setup is for local development; see the deployment guidance before hosting publicly.

## Verification

Run checks after setup:

```bash
npm run typecheck
npm run test:consent
npm run test:email
npm run build
```

Run `npm run test:consent-isolation` only against a disposable test database. The general `npm run test:isolation` command creates persistent test organisations and must not run against customer data. See [recorded validation results](docs/VALIDATION.md) for current failures and environment limitations; listing these commands does not mean all checks pass.

## Database access

| Connection | Purpose |
|---|---|
| `DATABASE_URL` / `app_user` | Running app; restricted role subject to tenant RLS |
| `DIRECT_URL` / `dpdpa_owner` | Migrations, security setup and control-library imports |

Do not run the app with a superuser or a role that bypasses RLS. Tenant queries must run inside `withTenant()` so the database receives transaction-local organisation/user context.

Database development requirements are documented in [Contributing](CONTRIBUTING.md).

## Scope and limitations

The controls are draft content for qualified legal review, including applicability and commencement dates. This software does not establish legal compliance or Board registration as a Consent Manager. Consent withdrawal follow-up is manual. MFA, SSO, billing, automatic processor notifications, guardian verification and a production retention/deletion workflow are not implemented. Library upgrades that must preserve the current assessment view require assessment carry-forward by control code.


