-- AlterTable
ALTER TABLE "DealerService" ADD COLUMN     "subscriptionId" UUID;

-- CreateIndex
CREATE INDEX "idx_ds_subscription_id" ON "DealerService"("subscriptionId");
