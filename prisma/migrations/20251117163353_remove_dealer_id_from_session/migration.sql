/*
  Warnings:

  - You are about to drop the column `dealerId` on the `Session` table. All the data in the column will be lost.
  - Added the required column `appId` to the `Inventory` table without a default value. This is not possible if the table is not empty.

*/
-- Drop RLS policy that depends on dealerId (must be dropped first)
DROP POLICY IF EXISTS "session_select" ON "Session";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "fk_sess_dealer";

-- DropIndex
DROP INDEX "idx_sess_dealer";

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "appId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "dealerId";

-- Recreate RLS policy without dealerId
CREATE POLICY "session_select" ON "Session"
  FOR SELECT USING (true);

-- CreateIndex
CREATE INDEX "idx_inv_app" ON "Inventory"("appId");

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "fk_inv_app" FOREIGN KEY ("appId") REFERENCES "DealerApp"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
