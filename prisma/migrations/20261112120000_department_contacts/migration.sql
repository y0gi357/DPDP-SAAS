BEGIN;
ALTER TABLE "Department" ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- Keep existing primary-contact columns for assessment/roadmap compatibility.
CREATE UNIQUE INDEX "Department_id_orgId_key" ON "Department"("id", "orgId");
CREATE INDEX "Department_orgId_idx" ON "Department"("orgId");
CREATE TABLE "DepartmentContact" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "orgId" TEXT NOT NULL,
 "departmentId" TEXT NOT NULL,
 "subFunction" TEXT NOT NULL,
 "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "name" TEXT NOT NULL,
 "email" TEXT,
 "designation" TEXT,
 "phone" TEXT,
 "responsibilities" TEXT,
 "isPrimary" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DepartmentContact_departmentId_orgId_fkey" FOREIGN KEY ("departmentId", "orgId")
 REFERENCES "Department"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DepartmentContact_orgId_idx" ON "DepartmentContact"("orgId");
CREATE INDEX "DepartmentContact_departmentId_orgId_idx" ON "DepartmentContact"("departmentId", "orgId");
CREATE UNIQUE INDEX "DepartmentContact_one_primary" ON "DepartmentContact"("departmentId", "orgId") WHERE "isPrimary";
-- RLS is already forced on Department. As owner, temporarily permit the one-time backfill.
ALTER TABLE "Department" NO FORCE ROW LEVEL SECURITY;
INSERT INTO "DepartmentContact" ("id", "orgId", "departmentId", "subFunction", "name", "email", "isPrimary")
SELECT 'legacy-' || "id", "orgId", "id", 'General', COALESCE(NULLIF(trim("spocName"), ''), ''), NULLIF(trim("spocEmail"), ''), true
FROM "Department" WHERE NULLIF(trim("spocName"), '') IS NOT NULL OR NULLIF(trim("spocEmail"), '') IS NOT NULL;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DepartmentContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DepartmentContact" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DepartmentContact"
 USING ("orgId" = nullif(current_setting('app.current_org', true), ''))
 WITH CHECK ("orgId" = nullif(current_setting('app.current_org', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON "DepartmentContact" TO app_user;
COMMIT;
