# Departments, sub-functions and SPOCs

Each department can contain multiple sub-functions, each with a separate SPOC, email, designation, phone, responsibilities and internal processing-role selections. Roles can also be recorded for the department as a whole. Not Applicable cannot be combined with other roles. Role selections record an internal assessment and do not establish legal status.

## Upgrade an existing installation

Back up the database first. Stop the application while applying the migration, then run:

```bash
npx prisma migrate deploy
npm run db:rls
npx prisma generate
npm run typecheck
npm run test:departments
```

Restart the application after migration and client generation. The new migration preserves each existing SPOC as a primary contact under a General sub-function, including an email-only legacy record that needs its missing name completed. The parent department IDs and existing app/RoPA links stay intact. Run migrations as the owner using the project's configured DIRECT_URL. Do not use db push in place of the committed migration.

## Use

Open Departments & SPOCs, add or edit a department, and select Add sub-function for each team. Enter its name and SPOC details, then select one named primary department SPOC. Save department commits the roster together. A sub-function may be recorded before its contact is assigned; incomplete contacts appear in gap checks. Removing the selected primary requires selecting another named contact, unless no assigned contacts remain.

The primary contact continues to supply existing department-level readiness checks. All sub-function contacts appear in PDF/DOCX reports and can be selected as remediation owners. Adding a contact does not create a user account; invitations remain in Team & Access.

Only roles with edit_org permission can change departments. Auditors remain read-only. Contacts use forced RLS and a composite parent foreign key including orgId; only one primary contact per department is allowed by a database constraint. The save transaction locks the parent and rejects IDs from other departments before changing the roster.

## Validation

`npm run test:departments` covers form validation, incomplete-contact gaps, foreign contact ID rejection, primary switching and roster replacement. Run `npm run test:department-isolation` only against a disposable, migrated PostgreSQL database using the restricted app role; its fixtures roll back. It checks multiple contacts, RLS, cross-tenant references, primary uniqueness and deletion cascade.
