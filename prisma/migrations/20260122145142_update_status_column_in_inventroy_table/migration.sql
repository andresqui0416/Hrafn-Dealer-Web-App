/*
  Warnings:

  - The `status` column on the `Inventory` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('pending', 'available', 'unavailable', 'sold');

-- AlterTable
ALTER TABLE "Inventory" DROP COLUMN "status",
ADD COLUMN     "status" "InventoryStatus" NOT NULL DEFAULT 'available';
