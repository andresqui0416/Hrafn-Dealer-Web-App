-- AlterTable
ALTER TABLE "PaymentHistory" ADD COLUMN     "stripeInvoiceId" TEXT,
ADD COLUMN     "stripeInvoiceUrl" TEXT;
