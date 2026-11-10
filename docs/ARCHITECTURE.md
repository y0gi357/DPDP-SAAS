# Architecture and trust boundaries

The application uses Next.js/React, Auth.js credentials authentication and Prisma with PostgreSQL. The browser reaches server-rendered pages and server actions; server-side code accesses the database and optionally SMTP.

## Data access

User authentication and organisation membership establish application permissions. Tenant work uses withTenant() to set transaction-local organisation/user context. PostgreSQL forced row-level security is a second boundary. DATABASE_URL must use app_user, never the owner or a role with BYPASSRLS. DIRECT_URL is reserved for migrations, RLS setup and seeding.

Published consent notices and decision events are protected from application-role updates/deletes. Database owners remain privileged. Backups, host access, database administration and log integrity outside the app are deployment responsibilities.

## Public consent portal

Email carries a 24-hour bearer token; only its hash is stored. Anyone with the valid URL can act for that subject. Issuing a replacement invalidates the old link. This is not government identity or guardian verification. Privacy responses disable caching/indexing and suppress referrers; deployment logs must also protect URLs.

Withdrawal creates internal follow-up tasks. It does not call a processor or stop external processing. Reports describe recorded assessments and evidence; they do not independently verify safeguards or legal compliance.

## Operational boundaries

Compose currently starts only PostgreSQL. Node runs the web app separately. Production hosting, TLS, backups, SMTP, monitoring, recovery and reviewed retention rules must be supplied by the operator. No Windows installer, hosted paid service or external discovery connector is included.
