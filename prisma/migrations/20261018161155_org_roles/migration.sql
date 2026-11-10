-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "actsAsFiduciary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "actsAsProcessor" BOOLEAN NOT NULL DEFAULT false;
