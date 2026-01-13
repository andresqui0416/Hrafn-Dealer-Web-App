/*
  Warnings:

  - Changed the type of `dmsType` on the `DealerDepartment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "DmsType" AS ENUM ('Parts', 'Service', 'Accounting', 'Finance');

-- AlterTable
ALTER TABLE "DealerDepartment" DROP COLUMN "dmsType",
ADD COLUMN     "dmsType" "DmsType" NOT NULL;

-- CreateIndex
CREATE INDEX "idx_dd_dms_type" ON "DealerDepartment"("dmsType");
