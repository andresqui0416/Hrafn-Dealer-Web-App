-- AlterTable
ALTER TABLE "DealerDepartment" ADD COLUMN     "lastSalesDataSyncAt" TIMESTAMPTZ(6),
ADD COLUMN     "salesDataSyncInProgress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salesDataSyncStartedAt" TIMESTAMPTZ(6);
