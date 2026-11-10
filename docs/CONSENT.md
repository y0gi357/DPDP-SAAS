# Business consent management

The **Consent records** sidebar entry (`/consent/records`) adds operational consent management alongside the existing notice draft and readiness checklist. It is software for a business managing its customers' choices; it does not establish Board registration as a Consent Manager.

Complete the [local setup](../README.md#local-setup), including migrations and RLS, before using this module.

Set `APP_URL`, `SMTP_URL` and `EMAIL_FROM` using `.env.example`. Portal access uses a random 256-bit bearer link, stored only as a SHA-256 hash, expiring after 24 hours. A replacement link invalidates the previous one. Production sends links only through SMTP; development may print or display the link for testing. Protect application/proxy access logs, since URLs contain credentials. Privacy pages suppress referrers, caching and search indexing. Anyone holding a valid link can act for that customer; higher assurance deployments should replace this with their authenticated customer identity system.

Workflow:

1. An owner/admin publishes a purpose, its data items, language, full notice, and systems/processors needing withdrawal follow-up. Each published notice is an immutable version. Use a new purpose key for a different processing purpose; use a new version for revised wording within that purpose. Review notices before publishing.
2. A contributor/admin adds a customer email/reference and sends a private portal link. Customers can also request access at `/privacy/<orgId>`; responses do not disclose whether an email is enrolled.
3. The customer reads the notice and explicitly grants or declines each purpose. Nothing is preselected, and staff cannot enter consent on their behalf. Grants on older versions are identified as such, and do not cover a newer notice. Stale submissions are rejected. The original grant can still be withdrawn after a new version is published or the purpose is paused.
4. Withdrawal records an immutable decision and creates a manual follow-up task for each configured system, including targets preserved in notices previously granted by that customer. Staff acknowledge each task with the action taken or lawful retention exception. **No external webhook or processor notification is sent and no remote processing is stopped automatically.** Configure systems before requesting consent and monitor this queue operationally. A later grant never cancels outstanding withdrawal tasks.
5. Customers can review their history and download JSON containing their decisions, exact notice versions and follow-up status. Staff can search customers and inspect their history. Aggregate evidence appears in Controls Assessment, Dashboard and PDF/DOCX reports; it does not automatically mark a control implemented.

Permissions follow the existing roles: OWNER/ADMIN publish/pause purposes; OWNER/ADMIN/SPOC enrol customers, issue/revoke links and acknowledge follow-up; AUDITOR is read-only. The five consent tables use forced tenant RLS and composite foreign keys that include `orgId`. The app database role cannot update/delete published notices or decision events. Updates are audited.

There is no automatic deletion job or blanket seven-year retention rule in this business module. Set and document the organisation's evidence-retention policy before production and implement a reviewed owner-controlled purge process as needed. Published versions and events are retained until then. Language codes label the supplied wording; the app does not translate notices. This version does not implement guardian verification, registered Consent Manager interoperability, external consent-capture APIs, webhooks or billing.

Validation commands: `npm run typecheck`, `npm run test:consent`, `npm run test:consent-isolation`. The database test uses the restricted `DATABASE_URL`, covers cross-tenant reads/writes and relationships, immutable history, expired/revoked portal access, and rolls back its fixtures.


### Consent Manager fiduciary readiness checklist

Open **Notice & Consent → Consent management** (`/consent?tab=cmp`). The checklist assesses receiving consent/withdrawal instructions through a Consent Manager, checking its Board registration, and passing withdrawals to relevant processors. The overall CM-integration answer is separate from the individual evidence items.

Record the CM legal name and registration reference, official listing/source URL, check date/reviewer and evidence; integration owner, consent/withdrawal channels and test results; processor routing owner, channels, acknowledgement/escalation process, internal timescale, lawful-processing exception procedure and test evidence. An **In place** answer requires the matching evidence fields, while **Not applicable** requires an explanation. Partial/unanswered items may be saved while evidence is gathered. Dates must be valid and no later than the current UTC date; source links must be HTTP(S) without embedded credentials. Use document/case references rather than secrets or customer data.

Readiness evidence is stored in the existing tenant-scoped `ConsentConfig.cmp` JSON and preserved with the checklist in the append-only audit log on save. It appears on matching fiduciary controls and in PDF/DOCX report evidence; answers do not automatically implement a control. The platform does not independently check the Board register, call CM endpoints or dispatch processor notifications. If several CMs/processors are involved, include the complete set and supporting document references in the evidence notes.

References: DPDP Act, Sec 6(6), 6(7), 6(9) and Sec 8(2); [official DPDP Rules, 2025, Rule 4](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf). Registration and integration remain staff assessments, not an assertion of independent verification. All committed migrations are required for the customer portal and withdrawal queue.


