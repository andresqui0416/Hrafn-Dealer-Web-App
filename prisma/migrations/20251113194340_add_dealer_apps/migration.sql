-- CreateEnum
CREATE TYPE "CrmType" AS ENUM ('CDK', 'Tekion');

-- CreateTable
CREATE TABLE "DealerApp" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "dealerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "crm_type" "CrmType" NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_app_dealer" ON "DealerApp"("dealerId");

-- AddForeignKey
ALTER TABLE "DealerApp" ADD CONSTRAINT "fk_app_dealer" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
