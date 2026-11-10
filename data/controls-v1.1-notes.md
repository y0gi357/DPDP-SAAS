# Controls library v1.1 (draft)

Prepared in `controls-v1.1.json`. This is now the default seed file, selected for test activation at the user’s request. The v1.0 file is unchanged. Database activation requires a successful seed run.

- `DPDP-10-005`: specifies periodic **data audits**.
- `DPDP-10-006`: specifies a DPIA and **data audit** every 12 months, retaining the existing reporting requirement.
- `DPDP-R4-001` through `DPDP-R4-006`: annotate **Rule 4 commencement: 13 November 2026** in `ruleRefs`, which the existing importer persists and the assessment UI displays. Each also carries structured `commencement` metadata for future use; the current importer does not persist this extra object.
- The Rule 4 date is an annotation, not a scoring exemption or a statement that every linked Act obligation commences that day. `DPDP-R4-006` explicitly distinguishes the linked fiduciary duties. Audiences remain unchanged: the first five controls are CM controls; the sixth is fiduciary readiness.

All 110 control codes and all section keys remain stable. The library remains a draft requiring legal review, not a certification that the whole library reflects every legal update.

## Sources

- [DPDP (Removal of Difficulties) Order, 2026, S.O. 5458(E)](https://www.meity.gov.in/static/uploads/2026/10/daf495a7b5798a3dfa72a944b51fc176.pdf), paragraph 2(ii): substitutes “data audit” in section 10(2)(c)(ii). Rule 13 itself is not amended by this Order; the two revised controls use the terminology to describe the relevant SDF audit work.
- [DPDP Rules, 2025, G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), Rule 1(3): Rule 4 commences one year after publication; 13 November 2026 is calculated from the Gazette publication date of 13 November 2025.
- [Corrigenda, G.S.R. 892(E)](https://www.meity.gov.in/static/uploads/2025/12/3c7ebbae0e5456f493f486e6845df86b.pdf), item (i): corrects the wording of the commencement clauses to refer to publication in the Official Gazette.

## Activation and existing assessments

The user has accepted fresh assessments for testing, so activation may use the current seeder. The current seed implementation creates a new library, sections and control IDs; existing assessments continue to reference the old IDs. Switching the active version without carrying assessments forward makes the active view appear unassessed, even though historical records remain.

Before an upgrade that must preserve the active assessment view, implement and validate an assessment carry-forward process that maps by control code, retains status/evidence/owners/target dates and provenance, flags the two wording changes for review, and leaves the original records intact. Date annotations alone must not alter saved statuses. Seeding v1.1 for testing is intentionally allowed to start a new assessment view. Old assessments are not deleted. Re-seeding a version that is already loaded reactivates its existing control IDs and assessments rather than duplicating them.
