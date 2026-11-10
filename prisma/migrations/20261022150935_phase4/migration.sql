-- CreateEnum
CREATE TYPE "BreachStatus" AS ENUM ('OPEN', 'CONTAINED', 'CLOSED');

-- CreateTable
CREATE TABLE "ConsentConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "rightsPortalUrl" TEXT,
    "crossBorderText" TEXT,
    "dataItems" TEXT[],
    "purposes" TEXT[],
    "cmp" JSONB,
    "cmpNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Breach" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "nature" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dataAffected" TEXT,
    "principalsAffected" INTEGER,
    "boardIntimatedAt" TIMESTAMP(3),
    "principalsIntimatedAt" TIMESTAMP(3),
    "detailedReportAt" TIMESTAMP(3),
    "status" "BreachStatus" NOT NULL DEFAULT 'OPEN',
    "rootCause" TEXT,
    "measures" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsentConfig_orgId_key" ON "ConsentConfig"("orgId");

-- CreateIndex
CREATE INDEX "Breach_orgId_idx" ON "Breach"("orgId");
