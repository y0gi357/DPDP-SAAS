-- CreateEnum
CREATE TYPE "CommitteeRole" AS ENUM ('CHAIR', 'MEMBER', 'DPO', 'LEGAL', 'IT_SECURITY', 'SECRETARY');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('APPLICATION', 'DATABASE', 'FILE_STORE', 'SAAS', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorRole" AS ENUM ('PROCESSOR', 'SUB_PROCESSOR', 'JOINT_FIDUCIARY', 'OTHER');

-- CreateEnum
CREATE TYPE "RiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "LegalBasis" AS ENUM ('CONSENT', 'LEGITIMATE_USE');

-- CreateEnum
CREATE TYPE "DataVolume" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "address" TEXT,
ADD COLUMN     "dpoEmail" TEXT,
ADD COLUMN     "dpoName" TEXT,
ADD COLUMN     "dpoPhone" TEXT,
ADD COLUMN     "employeeCount" INTEGER,
ADD COLUMN     "grievanceEmail" TEXT,
ADD COLUMN     "handlesChildrenData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "registrationNo" TEXT,
ADD COLUMN     "transfersAbroad" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "CommitteeMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "designation" TEXT,
    "role" "CommitteeRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headName" TEXT,
    "spocName" TEXT,
    "spocEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAsset" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL DEFAULT 'APPLICATION',
    "description" TEXT,
    "departmentId" TEXT,
    "ownerName" TEXT,
    "hostingLocation" TEXT,
    "hostedInIndia" BOOLEAN NOT NULL DEFAULT true,
    "storesPersonalData" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "service" TEXT,
    "role" "VendorRole" NOT NULL DEFAULT 'PROCESSOR',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "country" TEXT,
    "hasContract" BOOLEAN NOT NULL DEFAULT false,
    "contractExpiry" TIMESTAMP(3),
    "securityReviewed" BOOLEAN NOT NULL DEFAULT false,
    "riskTier" "RiskTier" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RopaRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "departmentId" TEXT,
    "assetId" TEXT,
    "principalCategories" TEXT[],
    "dataCategories" TEXT[],
    "legalBasis" "LegalBasis" NOT NULL DEFAULT 'CONSENT',
    "retention" TEXT,
    "volume" "DataVolume" NOT NULL DEFAULT 'LOW',
    "involvesChildren" BOOLEAN NOT NULL DEFAULT false,
    "crossBorder" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RopaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RopaVendor" (
    "ropaId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "RopaVendor_pkey" PRIMARY KEY ("ropaId","vendorId")
);

-- CreateIndex
CREATE INDEX "CommitteeMember_orgId_idx" ON "CommitteeMember"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_orgId_name_key" ON "Department"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DataAsset_orgId_name_key" ON "DataAsset"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_orgId_name_key" ON "Vendor"("orgId", "name");

-- CreateIndex
CREATE INDEX "RopaRecord_orgId_idx" ON "RopaRecord"("orgId");

-- CreateIndex
CREATE INDEX "RopaVendor_orgId_idx" ON "RopaVendor"("orgId");

-- AddForeignKey
ALTER TABLE "DataAsset" ADD CONSTRAINT "DataAsset_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RopaRecord" ADD CONSTRAINT "RopaRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RopaRecord" ADD CONSTRAINT "RopaRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DataAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RopaVendor" ADD CONSTRAINT "RopaVendor_ropaId_fkey" FOREIGN KEY ("ropaId") REFERENCES "RopaRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RopaVendor" ADD CONSTRAINT "RopaVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
