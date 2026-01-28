/*
  Warnings:

  - You are about to drop the column `apr` on the `Offers` table. All the data in the column will be lost.
  - You are about to drop the column `cash_back` on the `Offers` table. All the data in the column will be lost.
  - You are about to drop the column `due_at_signing` on the `Offers` table. All the data in the column will be lost.
  - You are about to drop the column `monthly_payment` on the `Offers` table. All the data in the column will be lost.
  - You are about to drop the column `term_months` on the `Offers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Offers" DROP COLUMN "apr",
DROP COLUMN "cash_back",
DROP COLUMN "due_at_signing",
DROP COLUMN "monthly_payment",
DROP COLUMN "term_months",
ADD COLUMN     "apr_rate" DECIMAL(8,4),
ADD COLUMN     "apr_term_months" INTEGER,
ADD COLUMN     "cash_value" DECIMAL(12,2),
ADD COLUMN     "lease_due_at_signing" DECIMAL(12,2),
ADD COLUMN     "lease_monthly_payment" DECIMAL(12,2),
ADD COLUMN     "lease_term_months" INTEGER;
