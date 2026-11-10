-- CreateEnum
CREATE TYPE "Sourcing" AS ENUM ('IN_HOUSE', 'OUTSOURCED');

-- CreateEnum
CREATE TYPE "VendorAccess" AS ENUM ('FULL_ACCESS', 'LIMITED_ACCESS', 'HOSTING_ONLY', 'ANONYMISED_ONLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssetType" ADD VALUE 'INTERNAL_DB';
ALTER TYPE "AssetType" ADD VALUE 'MOBILE_APP';
ALTER TYPE "AssetType" ADD VALUE 'SPREADSHEET';
ALTER TYPE "AssetType" ADD VALUE 'ONPREM_APP';
ALTER TYPE "AssetType" ADD VALUE 'CLOUD_STORAGE';
ALTER TYPE "AssetType" ADD VALUE 'DATA_WAREHOUSE';

-- AlterTable
ALTER TABLE "DataAsset" ADD COLUMN     "dataCategories" TEXT[],
ADD COLUMN     "piiFields" TEXT[],
ADD COLUMN     "sourcing" "Sourcing" NOT NULL DEFAULT 'IN_HOUSE',
ADD COLUMN     "vendorAccess" "VendorAccess",
ADD COLUMN     "vendorId" TEXT,
ALTER COLUMN "type" SET DEFAULT 'SAAS';

-- AddForeignKey
ALTER TABLE "DataAsset" ADD CONSTRAINT "DataAsset_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
