-- Row-level security for tenant tables + least-privilege grants for app_user.
-- Idempotent. Run as the OWNER role (npm run db:rls).
-- Every request sets app.current_org / app.current_user via withTenant() (src/lib/tenant.ts).

ALTER TABLE "Organisation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organisation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Organisation";
CREATE POLICY org_isolation ON "Organisation"
  USING (id = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK (id = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_access ON "Membership";
-- A user may read their own memberships (needed at login, before an org is chosen).
CREATE POLICY membership_access ON "Membership"
  USING ("orgId" = nullif(current_setting('app.current_org', true), '')
      OR "userId" = nullif(current_setting('app.current_user', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "ControlAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ControlAssessment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assessment_isolation ON "ControlAssessment";
CREATE POLICY assessment_isolation ON "ControlAssessment"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_isolation ON "AuditLog";
CREATE POLICY audit_isolation ON "AuditLog"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "CommitteeMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommitteeMember" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CommitteeMember";
CREATE POLICY tenant_isolation ON "CommitteeMember"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Department";
CREATE POLICY tenant_isolation ON "Department"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "DataAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataAsset" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DataAsset";
CREATE POLICY tenant_isolation ON "DataAsset"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "Vendor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vendor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Vendor";
CREATE POLICY tenant_isolation ON "Vendor"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "RopaRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RopaRecord" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RopaRecord";
CREATE POLICY tenant_isolation ON "RopaRecord"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "RopaVendor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RopaVendor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RopaVendor";
CREATE POLICY tenant_isolation ON "RopaVendor"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "SubProcessor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubProcessor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SubProcessor";
CREATE POLICY tenant_isolation ON "SubProcessor"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "RopaAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RopaAsset" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RopaAsset";
CREATE POLICY tenant_isolation ON "RopaAsset"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "GapTracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GapTracking" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "GapTracking";
CREATE POLICY tenant_isolation ON "GapTracking"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "Dpia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dpia" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Dpia";
CREATE POLICY tenant_isolation ON "Dpia"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "ConsentConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentConfig" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ConsentConfig";
CREATE POLICY tenant_isolation ON "ConsentConfig"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "Breach" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Breach" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Breach";
CREATE POLICY tenant_isolation ON "Breach"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));

ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Invitation";
CREATE POLICY tenant_isolation ON "Invitation"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));
-- Someone holding the invite link can read and accept exactly that invitation, before they belong to the organisation.
DROP POLICY IF EXISTS invite_by_token ON "Invitation";
CREATE POLICY invite_by_token ON "Invitation"
  USING ("tokenHash" = nullif(current_setting('app.invite_token', true), ''))
  WITH CHECK ("tokenHash" = nullif(current_setting('app.invite_token', true), ''));

-- Members can see the names of the organisations they belong to (for the organisation switcher).
DROP POLICY IF EXISTS org_member_read ON "Organisation";
CREATE POLICY org_member_read ON "Organisation" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Membership" m WHERE m."orgId" = "Organisation".id
                 AND m."userId" = nullif(current_setting('app.current_user', true), '')));

-- Grants
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Legal content is read-only for the app.
REVOKE INSERT, UPDATE, DELETE ON "ControlLibraryVersion", "ControlSection", "Control" FROM app_user;
-- Audit log is append-only.
REVOKE UPDATE, DELETE ON "AuditLog" FROM app_user;
-- Migration bookkeeping is not the app's business.
REVOKE ALL ON "_prisma_migrations" FROM app_user;

-- Business consent tables use the same transaction-local tenant context.
ALTER TABLE "ConsentPurpose" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentPurpose" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ConsentPurpose";
CREATE POLICY tenant_isolation ON "ConsentPurpose"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));
ALTER TABLE "ConsentNotice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentNotice" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ConsentNotice";
CREATE POLICY tenant_isolation ON "ConsentNotice"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));
ALTER TABLE "ConsentSubject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentSubject" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ConsentSubject";
CREATE POLICY tenant_isolation ON "ConsentSubject"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));
ALTER TABLE "ConsentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ConsentEvent";
CREATE POLICY tenant_isolation ON "ConsentEvent"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));
ALTER TABLE "ConsentWithdrawalTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentWithdrawalTask" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ConsentWithdrawalTask";
CREATE POLICY tenant_isolation ON "ConsentWithdrawalTask"
  USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
  WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON "ConsentPurpose", "ConsentSubject", "ConsentWithdrawalTask" TO app_user;
GRANT SELECT, INSERT ON "ConsentNotice", "ConsentEvent" TO app_user;
REVOKE UPDATE, DELETE ON "ConsentNotice", "ConsentEvent" FROM app_user;
