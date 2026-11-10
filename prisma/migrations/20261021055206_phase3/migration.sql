-- CreateEnum
CREATE TYPE "GapStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ADDRESSED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "DpiaStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "GapTracking" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "gapKey" TEXT NOT NULL,
    "status" "GapStatus" NOT NULL DEFAULT 'OPEN',
    "owners" TEXT[],
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GapTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dpia" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ropaId" TEXT,
    "activity" TEXT NOT NULL,
    "department" TEXT,
    "riskLevel" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskFactors" JSONB NOT NULL,
    "necessity" TEXT NOT NULL,
    "proportionality" TEXT NOT NULL,
    "mitigations" TEXT[],
    "residualLevel" "RiskTier" NOT NULL DEFAULT 'MEDIUM',
    "residualNote" TEXT,
    "reviewNotes" TEXT,
    "status" "DpiaStatus" NOT NULL DEFAULT 'DRAFT',
    "auto" BOOLEAN NOT NULL DEFAULT true,
    "sdfMandated" BOOLEAN NOT NULL DEFAULT false,
    "outdated" BOOLEAN NOT NULL DEFAULT false,
    "approverRef" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dpia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GapTracking_orgId_idx" ON "GapTracking"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "GapTracking_orgId_gapKey_key" ON "GapTracking"("orgId", "gapKey");

-- CreateIndex
CREATE INDEX "Dpia_orgId_idx" ON "Dpia"("orgId");

-- AddForeignKey
ALTER TABLE "Dpia" ADD CONSTRAINT "Dpia_ropaId_fkey" FOREIGN KEY ("ropaId") REFERENCES "RopaRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
