/*
  Warnings:

  - You are about to drop the column `fortellis_client_id` on the `Dealer` table. All the data in the column will be lost.
  - You are about to drop the column `fortellis_client_secret` on the `Dealer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Dealer" DROP COLUMN "fortellis_client_id",
DROP COLUMN "fortellis_client_secret";
