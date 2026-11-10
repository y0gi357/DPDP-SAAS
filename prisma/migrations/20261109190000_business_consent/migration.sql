-- CreateEnum
CREATE TYPE "ConsentChoice" AS ENUM ('GRANTED', 'DENIED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "ConsentPurpose" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "targets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentPurpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentNotice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dataItems" TEXT[],
    "text" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,
    "targets" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ConsentNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentSubject" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reference" TEXT,
    "tokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "choice" "ConsentChoice" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CUSTOMER_PORTAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentWithdrawalTask" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "ConsentWithdrawalTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentPurpose_orgId_idx" ON "ConsentPurpose"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentPurpose_orgId_id_key" ON "ConsentPurpose"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentPurpose_orgId_key_key" ON "ConsentPurpose"("orgId", "key");

-- CreateIndex
CREATE INDEX "ConsentNotice_orgId_idx" ON "ConsentNotice"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentNotice_orgId_purposeId_id_key" ON "ConsentNotice"("orgId", "purposeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentNotice_orgId_purposeId_version_key" ON "ConsentNotice"("orgId", "purposeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentSubject_tokenHash_key" ON "ConsentSubject"("tokenHash");

-- CreateIndex
CREATE INDEX "ConsentSubject_orgId_idx" ON "ConsentSubject"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentSubject_orgId_id_key" ON "ConsentSubject"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentSubject_orgId_email_key" ON "ConsentSubject"("orgId", "email");

-- CreateIndex
CREATE INDEX "ConsentEvent_orgId_subjectId_purposeId_revision_idx" ON "ConsentEvent"("orgId", "subjectId", "purposeId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentEvent_orgId_id_key" ON "ConsentEvent"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentEvent_orgId_subjectId_revision_key" ON "ConsentEvent"("orgId", "subjectId", "revision");

-- CreateIndex
CREATE INDEX "ConsentWithdrawalTask_orgId_idx" ON "ConsentWithdrawalTask"("orgId");

-- AddForeignKey
ALTER TABLE "ConsentNotice" ADD CONSTRAINT "ConsentNotice_orgId_purposeId_fkey" FOREIGN KEY ("orgId", "purposeId") REFERENCES "ConsentPurpose"("orgId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_orgId_subjectId_fkey" FOREIGN KEY ("orgId", "subjectId") REFERENCES "ConsentSubject"("orgId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_orgId_purposeId_fkey" FOREIGN KEY ("orgId", "purposeId") REFERENCES "ConsentPurpose"("orgId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_orgId_purposeId_noticeId_fkey" FOREIGN KEY ("orgId", "purposeId", "noticeId") REFERENCES "ConsentNotice"("orgId", "purposeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentWithdrawalTask" ADD CONSTRAINT "ConsentWithdrawalTask_orgId_eventId_fkey" FOREIGN KEY ("orgId", "eventId") REFERENCES "ConsentEvent"("orgId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


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
