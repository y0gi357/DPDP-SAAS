/*
  Warnings:

  - You are about to drop the column `ownerId` on the `ControlAssessment` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "ControlStatus" ADD VALUE 'PLANNED';

-- AlterTable
ALTER TABLE "Control" ADD COLUMN     "audience" TEXT[];

-- AlterTable
ALTER TABLE "ControlAssessment" DROP COLUMN "ownerId",
ADD COLUMN     "owners" TEXT[];
