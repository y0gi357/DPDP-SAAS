# Fictional demonstration

## Populate the local TestOrg quickly

After applying current migrations and seeding the control library, run:

```bash
npm run db:demo
npm run db:demo -- --apply
```

The first command previews; the second inserts detailed fictional data into the existing TestOrg/Test Org on localhost. It refuses ambiguous names; set DEMO_ORG_ID to choose the exact tenant when required. A missing tenant, active library or department migration stops the load. No organisation or login account is created.

The loader adds 8 departments with 24 sub-functions, 7 committee members, 6 vendors and their subprocessors, 10 linked application/RoPA/DPIA examples, mixed control assessments and remediation, 3 consent purposes with notice versions, 8 fictional customers with synthetic decisions, and 3 simulated incidents. Existing records and assessments are preserved; generated records use stable IDs so reruns do not duplicate them. Profile fields are filled only when empty. No emails or regulatory notifications are sent, external systems contacted, or live portal tokens created. Consent events are marked DEMO_SEED; approvals/evidence are expressly fictional. Existing notice settings are preserved if already configured.

Before inserting, it writes a private tenant snapshot under ignored backups/. Also take a normal database backup if the instance matters; the snapshot is not an automatic restore tool. All database writes run in one transaction. Refresh the app, select TestOrg, and generate reports through the Reports page. The dataset uses sample people and business records for this walkthrough; it does not represent customer operations. Explain this once when introducing the recording.

## Refresh earlier fictional entries for the same recording

If TestOrg already contains manually entered demo data, run:

```bash
npm run db:demo:refresh
```

This explicitly rewrites existing fictional profile fields, contacts, vendor reviews, application details, RoPA checklists, DPIA narratives, assessments, remediation notes, consent configuration and incident descriptions to the same scenario. IDs and links are retained; existing names of departments, apps, vendors and activities are kept so they remain recognisable. Extra earlier entries are enriched, not deleted or merged. Login users, passwords and organisation memberships are unchanged. A private pre-change tenant snapshot is saved first and database changes share one transaction.

Earlier fictional customer contact details become reserved-domain addresses and their previous portal links are revoked. Existing published notices and decision/audit history are not rewritten: a new fictional notice version is published for an earlier purpose where necessary. The presentation pass uses natural sample names, customer references and business descriptions in current records. Earlier published notice versions and audit records are retained as historical records. Use this mode only for the TestOrg data you have confirmed is fictional.

## Presentation walkthrough

Use a disposable local environment with no real customer information. Do not publish a live admin session or development email tokens. Preflight migrations, RLS and controls seeding using README instructions.

1. Register “Example Services Demo” with an address you control; verify using the development email link. Do not use a shared preset password.
2. Add a fictional department, an application called “Demo CRM” and a vendor called “Example Processor”.
3. Record a customer-support processing activity in RoPA, including purpose, data categories, retention and vendor links. Explain that this is entered information, not a database scan.
4. Show risk screening and DPIA review. Display applicable controls, gaps and assigned remediation. Demonstrate the difference between a documented answer and evidence of implementation.
5. Publish a fictional consent purpose and notice. Enrol a demonstration customer using an address you control, open its private portal, grant and withdraw. Show the exact notice version and manual withdrawal tasks. No remote deletion occurs.
6. Open the dashboard and generate PDF/DOCX reports. Confirm the examples appear correctly and no private data is included.
7. Show the audit history and explain role restrictions and tenant isolation, along with known limitations.

Before the event, rehearse the full sequence and keep an offline screen recording and sample reports. Reset only a disposable demo database using a reviewed procedure; this project ships no automatic demo-reset command.

## Presentation copy

The refresh command prepares current views for a business presentation: ordinary sample names, name-based email addresses, CUST account references and concise descriptions. It removes sample-data prefixes from current inventory names and avoids repeating sample-data explanations in each field. Realistic records remain sample content; describe that once in the introduction. The script does not change the application authentication accounts or send any messages. Historical published notices and audit records are retained.
