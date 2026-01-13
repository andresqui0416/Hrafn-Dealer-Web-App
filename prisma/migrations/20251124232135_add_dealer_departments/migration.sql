-- CreateTable
CREATE TABLE "DealerDepartment" (
    "id" TEXT NOT NULL,
    "dmsType" TEXT NOT NULL,
    "dealerId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_dd_dealer" ON "DealerDepartment"("dealerId");

-- CreateIndex
CREATE INDEX "idx_dd_service" ON "DealerDepartment"("serviceId");

-- CreateIndex
CREATE INDEX "idx_dd_dms_type" ON "DealerDepartment"("dmsType");

-- AddForeignKey
ALTER TABLE "DealerDepartment" ADD CONSTRAINT "fk_dd_dealer" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DealerDepartment" ADD CONSTRAINT "fk_dd_service" FOREIGN KEY ("serviceId") REFERENCES "DealerService"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
