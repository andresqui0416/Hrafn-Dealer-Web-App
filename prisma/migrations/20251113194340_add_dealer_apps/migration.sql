-- CreateTable
CREATE TABLE "dealer_apps" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "dealerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fortellis_client_id" TEXT NOT NULL,
    "fortellis_client_secret" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_apps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_app_dealer" ON "dealer_apps"("dealerId");

-- AddForeignKey
ALTER TABLE "dealer_apps" ADD CONSTRAINT "fk_app_dealer" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
