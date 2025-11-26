-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('pending', 'reviewing', 'rejected', 'allowed');

-- CreateTable
CREATE TABLE "ServiceKind" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceKind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerService" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "dealerId" UUID NOT NULL,
    "serviceKindId" UUID NOT NULL,
    "orgName" TEXT NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceKind_name_key" ON "ServiceKind"("name");

-- CreateIndex
CREATE INDEX "idx_ds_dealer" ON "DealerService"("dealerId");

-- CreateIndex
CREATE INDEX "idx_ds_service_kind" ON "DealerService"("serviceKindId");

-- CreateIndex
CREATE INDEX "idx_ds_status" ON "DealerService"("status");

-- CreateIndex
CREATE UNIQUE INDEX "u_ds_dealer_service" ON "DealerService"("dealerId", "serviceKindId");

-- AddForeignKey
ALTER TABLE "DealerService" ADD CONSTRAINT "fk_ds_dealer" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DealerService" ADD CONSTRAINT "fk_ds_service_kind" FOREIGN KEY ("serviceKindId") REFERENCES "ServiceKind"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
