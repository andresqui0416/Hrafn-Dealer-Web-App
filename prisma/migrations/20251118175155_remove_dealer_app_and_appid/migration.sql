/*
  Warnings:

  - You are about to drop the column `appId` on the `Inventory` table. All the data in the column will be lost.
  - You are about to drop the `DealerApp` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DealerApp" DROP CONSTRAINT "fk_app_dealer";

-- DropForeignKey
ALTER TABLE "Inventory" DROP CONSTRAINT "fk_inv_app";

-- DropIndex
DROP INDEX "idx_inv_app";

-- AlterTable
ALTER TABLE "Inventory" DROP COLUMN "appId";

-- DropTable
DROP TABLE "DealerApp";

-- DropEnum
DROP TYPE "CrmType";
