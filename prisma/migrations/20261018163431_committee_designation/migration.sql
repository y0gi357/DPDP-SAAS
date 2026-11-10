/*
  Warnings:

  - You are about to drop the column `role` on the `CommitteeMember` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CommitteeMember" DROP COLUMN "role",
ADD COLUMN     "function" TEXT;

-- DropEnum
DROP TYPE "CommitteeRole";
