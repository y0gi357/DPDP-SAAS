# Community edition video walkthrough

Target length: 7–8 minutes including navigation. Read the quoted text; the action lines are recording cues. Use the records actually visible in TestOrg. Counts and scores can change, so do not quote preset totals.

Before recording: select TestOrg, close terminals and notifications, use browser zoom at 100%, and open a generated PDF in another tab. Rehearse finding Customer support resolution, Support Desk and HelpHarbor Support. If the application lists an alternative name from your earlier data, use that name consistently. This recording reviews populated records; it does not require typing new records or sending emails.

## 1. Introduction — Implementation Flow — 0:00–0:40

Action: Start on Implementation Flow. Show the complete diagram using Fit to width. Briefly select Departments or RoPA; do not play the entire animation.

> Hello, I’m [your name]. This is the community edition of our DPDP implementation and assessment platform.
>
> It helps an organisation understand its personal-data processing, assign responsibility, assess risks and track improvements in one workspace.
>
> I’ll use TestOrg and sample business records to demonstrate the journey from a processing activity to an assessment report.
>
> The implementation flow gives teams an ordered starting point, from organisation setup and discovery through assessment, remediation and reporting.

## 2. Governance — 0:40–1:25

Action: Organisation Setup → DPDPA Committee → Departments & SPOCs. Pause at Engineering / Product or Information Technology and show several sub-functions.

> We begin with the organisation’s business context, processing roles and privacy contacts.
>
> The committee brings together executive, privacy, legal, security and business responsibilities.
>
> Departments can contain multiple sub-functions, each with its own contact, responsibilities and role selections. A primary contact coordinates the department overall.
>
> This gives the assessment a clear ownership structure. A gap can be assigned to someone who understands the relevant process.

## 3. Applications and vendors — 1:25–2:10

Action: Apps & Data Sources → find Support Desk → open Edit to display its fields, then Cancel. Vendors & TPRM → find HelpHarbor Support; show its review/contract fields.

> Next, we identify where personal data is handled.
>
> The application inventory records the system owner, department, hosting location and personal-data categories. It also distinguishes internal systems from outsourced services.
>
> For example, Support Desk supports customer enquiries and is linked to its service provider.
>
> The vendor register records the provider’s processing role, contract position, security safeguards, request contact and subprocessors. This makes third-party dependencies visible alongside the internal inventory.

## 4. RoPA and data flow — 2:10–3:10

Action: RoPA / Data Mapping → Customer support resolution → Edit. Show purpose, data fields, retention, application/vendor links and the checklist. Cancel. Open Data Flow and use Fit to width; briefly zoom in if needed.

> The Record of Processing Activities, or RoPA, connects those inventories to a specific business purpose.
>
> Here, customer support resolution records why the data is needed, whose information is involved, which fields are used, the recorded lawful basis and the retention approach.
>
> The activity is linked to its department, application and processor. The checklist captures the assessment of relevant safeguards and the supporting technical details.
>
> Data Flow turns the recorded relationships into a visual map. We can follow information from the customer through systems and departments to processors, or filter the view to a department.
>
> This diagram is generated from the entered inventory and processing records; it is not a live network or database scan.

## 5. DPIA and controls — 3:10–4:15

Action: DPIA → select an existing review using Edit. Show factors, necessity, proportionality, mitigations and review state. Cancel. Controls Assessment → show one partial control and its evidence fields.

> The next step is to examine risk.
>
> The platform provides risk screening to help prioritise review. A Data Protection Impact Assessment, or DPIA, records necessity, proportionality, potential impacts, mitigations and residual risk.
>
> Draft, review and approval states help teams track the assessment’s progress. The reviewer still needs to evaluate the underlying facts and safeguards.
>
> Controls Assessment then provides a structured view of implementation status, ownership, evidence and target dates.
>
> A recorded status and its evidence can be reviewed together. The score summarises assessment progress; it is not a legal-compliance certificate.

## 6. Gaps and remediation — 4:15–4:55

Action: Gap Analysis & Remediation → expand one detected gap; show owner, due date, notes and status. Avoid changing status just to improve the score.

> The assessment becomes actionable through Gap Analysis and Remediation.
>
> Teams can review detected issues, prioritise them, assign owners and track dates, progress and follow-up notes.
>
> For an incomplete safeguard, the owner can document the corrective work and the evidence needed for closure. This gives management a view of what remains unresolved and who is responsible for the next action.

## 7. Consent and incidents — 4:55–6:05

Action: Notice & Consent → briefly show the notice/checklist. Consent records → show Optional product updates, a customer's choices and Withdrawal follow-up. Do not send a portal link or publish a notice during this recording. Breach Register → show an existing incident.

> Notice and consent management connects customer choices to specific processing purposes.
>
> The platform supports purpose-specific notices, version history and records of grants, refusals and withdrawals. An older decision remains associated with the notice version shown at that time.
>
> Withdrawal creates follow-up tasks for the recorded systems or processors. This edition uses a manual queue: staff must carry out the action and record the response. The tool does not automatically delete data in external systems.
>
> The Breach Register provides a separate workspace for incident details, affected information, response measures and notification records.
>
> Together, these modules help teams organise operational privacy work alongside their assessments.

## 8. Reporting and closing — 6:05–7:15

Action: Generate Report → show Pre-flight checklist → Download .pdf. Switch to the prepared report if download is slow. Show executive summary and remediation sections, then return to Dashboard.

> Finally, the recorded information is brought together in PDF and editable Word reports.
>
> The pre-flight checklist highlights missing information and unresolved issues before the report is generated. The report includes governance, inventories, processing activities, assessments, priority gaps and remediation.
>
> Management can use the summary to discuss priorities, while reviewers can examine the supporting detail.
>
> The dashboard provides an overview of recorded progress and outstanding work.
>
> The community edition’s contribution is bringing these workflows into a shared, self-hosted application: from understanding the data to assigning action and producing reviewable reports.
>
> The source and documentation are available on GitHub. Thank you.

## Recording notes

- Keep the introduction's sample-record explanation once; no need to repeat it on every screen.
- Pause briefly after navigation. Move the pointer to the field you are discussing.
- Skip login, installation, full data entry and long loading/download waits.
- Do not describe draft controls as legally approved or populated sample evidence as independently tested.
- Record the existing consent history without expanding old seeded notices if those historical versions still have earlier presentation labels.
- For a shorter cut, combine governance screens and omit the incident section; retain the connected RoPA → risk → gap → report story.
