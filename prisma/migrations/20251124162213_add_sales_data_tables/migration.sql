-- CreateTable
CREATE TABLE "SaleData" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "dealerId" UUID NOT NULL,
    "dealNo" TEXT NOT NULL,
    "status" TEXT,
    "dealStatusDate" TIMESTAMPTZ(6),
    "changedDate" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleCommission" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "commissionGross" DECIMAL(12,2),
    "commissionPack" DECIMAL(12,2),
    "commOnSaleDlr" DECIMAL(12,2),
    "surplusCash" DECIMAL(12,2),
    "optionsCommDlr" DECIMAL(12,2),
    "commissionsBase" JSONB,
    "sp1Bonus" DECIMAL(12,2),
    "sp1Commission" TEXT,
    "sp1SaleCreditSP" TEXT,
    "sp1SurplusCash" TEXT,
    "sp1TotalCommission" DECIMAL(12,2),
    "sp2Bonus" DECIMAL(12,2),
    "sp2Commission" TEXT,
    "sp2SaleCreditSP" TEXT,
    "sp2SurplusCash" TEXT,
    "sp2TotalCommission" DECIMAL(12,2),
    "sp2PurchaseMBISPCommAmount" DECIMAL(12,2),
    "sp3Bonus" DECIMAL(12,2),
    "sp3Commission" TEXT,
    "sp3SaleCreditSP" TEXT,
    "sp3SurplusCash" TEXT,

    CONSTRAINT "SaleCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleDeal" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "dealNo" TEXT,
    "accountingAccount" TEXT,
    "accountingDate" TIMESTAMPTZ(6),
    "branch" TEXT,
    "contractDate" DATE,
    "creationDate" DATE,
    "salesDate" DATE,
    "adjustedCapCost" DECIMAL(12,2),
    "adjustedCostofVehicle" DECIMAL(12,2),
    "adjustmentsDealerDefined" DECIMAL(12,2),
    "adjustmentsROPO" DECIMAL(12,2),
    "adjustmentsStandard" DECIMAL(12,2),
    "amountDueAtStart" DECIMAL(12,2),
    "apr" DECIMAL(8,4),
    "backGross" DECIMAL(12,2),
    "balloonAmount" DECIMAL(12,2),
    "balloonRate" TEXT,
    "bankFee" TEXT,
    "baseMSRP" TEXT,
    "msrpFee1" TEXT,
    "msrpFee2" TEXT,
    "baseResidual" DECIMAL(12,2),
    "buyRateAddOn" DECIMAL(8,4),
    "buyRateAPR" DECIMAL(8,4),
    "buyRateLMF" TEXT,
    "calcMethod" TEXT,
    "cashCapReduction" DECIMAL(12,2),
    "capCostReductionTax2Amount" DECIMAL(12,2),
    "cashDown" TEXT,
    "cashPrice" DECIMAL(12,2),
    "costPrice" DECIMAL(12,2),
    "customerCashDown" DECIMAL(12,2),
    "customerComments" TEXT,
    "depositAmount" TEXT,
    "depositType" TEXT,
    "dmvRosNumber" TEXT,
    "dueOnDelivery" DECIMAL(12,2),
    "fiDealType" TEXT,
    "fiIncome" DECIMAL(12,2),
    "financeAmt" DECIMAL(12,2),
    "financeCharge" DECIMAL(12,2),
    "financeSource" TEXT,
    "finInstituteCode" TEXT,
    "firstPayDate" DATE,
    "fiWipStatusCode" TEXT,
    "frontEndGrossProfit" DECIMAL(12,2),
    "frontGross" DECIMAL(12,2),
    "grossProfit" DECIMAL(12,2),
    "hostItemId" TEXT,
    "initialCapCost" TEXT,
    "lastPayAmount" DECIMAL(12,2),
    "lastPayDate" DATE,
    "leaseEndPercentageRate" DECIMAL(8,4),
    "leaseEndValue" DECIMAL(12,2),
    "leaseMileageAllowance" DECIMAL(12,2),
    "leasePayment" TEXT,
    "leaseType" TEXT,
    "levelizedLifeAmount" DECIMAL(12,2),
    "levelizedLifeCost" TEXT,
    "levelizedLifeIncome" TEXT,
    "lienHolderAddress" TEXT,
    "lienHolderCity" TEXT,
    "lienHolderName" TEXT,
    "lienHolderName2" TEXT,
    "lienHolderPhone" TEXT,
    "lienHolderState" TEXT,
    "lienHolderZip" TEXT,
    "mileageExpected" INTEGER,
    "mileageExpectedFlag" TEXT,
    "mileageMonthlyLimit" TEXT,
    "mileagePenaltyAmount" DECIMAL(12,2),
    "mileagePenaltyRate" DECIMAL(8,4),
    "miscellaneous1" TEXT,
    "miscellaneous2" TEXT,
    "miscellaneous3" TEXT,
    "miscellaneous4" TEXT,
    "miscellaneous5" TEXT,
    "miscellaneous6" TEXT,
    "miscellaneous7" TEXT,
    "miscellaneous8" TEXT,
    "miscellaneous9" TEXT,
    "miscellaneous10" TEXT,
    "dealerDefined1" TEXT,
    "dealerDefined2" TEXT,
    "dealerDefined3" TEXT,
    "dealerDefined4" TEXT,
    "dealerDefined5" TEXT,
    "dealerDefined6" TEXT,
    "dealerDefined7" TEXT,
    "dealerDefined8" TEXT,
    "msrp" DECIMAL(12,2),
    "onePayAmount" TEXT,
    "outTheDoorPrice" DECIMAL(12,2),
    "paymentAmt" DECIMAL(12,2),
    "paymentCode" TEXT,
    "payments" INTEGER,
    "paymentStyle" TEXT,
    "pickupPay1" TEXT,
    "pickupDate1" DATE,
    "pickupPay2" TEXT,
    "pickupDate2" DATE,
    "pickupPay3" TEXT,
    "pickupDate3" DATE,
    "salePriceWithWeOwes" DECIMAL(12,2),
    "salesAccount" TEXT,
    "salesManagementDealType" TEXT,
    "saleType" TEXT,
    "securityDepositAmount" DECIMAL(12,2),
    "securityDepositName" TEXT,
    "sellRateAddOn" DECIMAL(8,4),
    "sellRateAPR" TEXT,
    "sellRateLMF" TEXT,
    "slsDealType" TEXT,
    "term" INTEGER,
    "unpaidBalance" DECIMAL(12,2),
    "waqNumber" TEXT,
    "dealSource" TEXT,
    "dealType" TEXT,

    CONSTRAINT "SaleDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleDealAuxiliary" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "fiAux1" TEXT,
    "fiAux2" TEXT,
    "fiAux3" TEXT,
    "fiAux4" TEXT,
    "fiAux5" TEXT,
    "fiAux6" TEXT,
    "fiAux7" TEXT,
    "fiAux8" TEXT,
    "fiAux9" TEXT,
    "fiAux10" TEXT,
    "fiAux11" TEXT,
    "fiAux12" TEXT,
    "fiAux13" TEXT,
    "fiAux14" TEXT,
    "fiAux15" TEXT,
    "fiAux16" TEXT,
    "fiAux17" TEXT,
    "fiAux18" TEXT,
    "fiAux19" TEXT,
    "fiAux20" TEXT,
    "fiAux21" TEXT,
    "fiAux22" TEXT,
    "fiAux23" TEXT,
    "fiAux24" TEXT,
    "fiAux25" TEXT,
    "fiAux26" TEXT,
    "fiAux27" TEXT,
    "fiAux28" TEXT,
    "fiAux29" TEXT,
    "fiAux30" TEXT,
    "fiAux31" TEXT,
    "fiAux32" TEXT,
    "fiAux33" TEXT,
    "fiAux34" TEXT,
    "fiAux35" TEXT,
    "fiAux36" TEXT,
    "fiAux37" TEXT,
    "fiAux38" TEXT,
    "fiAux39" TEXT,
    "fiAux40" TEXT,
    "fiAux41" TEXT,
    "fiAux42" TEXT,
    "fiAux43" TEXT,
    "fiAux44" TEXT,
    "fiAux45" TEXT,
    "fiAux46" TEXT,
    "fiAux47" TEXT,
    "fiAux48" TEXT,
    "fiAux49" TEXT,
    "fiAux50" TEXT,

    CONSTRAINT "SaleDealAuxiliary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleDealEvent" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "specialContract1Date" DATE,
    "specialContract1Reason" TEXT,
    "specialContract2Date" DATE,
    "specialContract2Reason" TEXT,
    "dealEvent" TEXT,
    "dealEventDate" DATE,
    "eventOrder" INTEGER,

    CONSTRAINT "SaleDealEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleFee" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "feeType" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "name" TEXT,
    "costAmount" DECIMAL(12,2),
    "profitType" TEXT,
    "flag" BOOLEAN,
    "orderIndex" INTEGER,

    CONSTRAINT "SaleFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleIncentive" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "incentiveDealer" DECIMAL(12,2),
    "incentiveProgram" DECIMAL(12,2),
    "rebateAmount" DECIMAL(12,2),
    "commonRebateDetails" JSONB,

    CONSTRAINT "SaleIncentive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleInsurance" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "extWarrantyExpMilesLease" INTEGER,
    "extWarrantyTermLease" INTEGER,
    "insuranceTypeCode" TEXT,
    "texasGAPInsuranceAmount" DECIMAL(12,2),
    "insurance1" JSONB,
    "insurance2" JSONB,
    "insurance3" JSONB,
    "ahiCost" DECIMAL(12,2),
    "ahiIncome" DECIMAL(12,2),
    "ahiMonthlyMaxAmount" DECIMAL(12,2),
    "ahiPremium" DECIMAL(12,2),
    "ahiRate" DECIMAL(8,4),
    "ahiTerm" INTEGER,
    "cliCost" DECIMAL(12,2),
    "cliIncome" DECIMAL(12,2),
    "cliMonthlyMaxAmount" DECIMAL(12,2),
    "cliPremium" DECIMAL(12,2),
    "cliRate" DECIMAL(8,4),
    "cliTerm" INTEGER,
    "cliInsuranceType" TEXT,
    "mbiCarrier" TEXT,
    "mbiCost" DECIMAL(12,2),
    "mbiDeductible" DECIMAL(12,2),
    "mbiEligComment" TEXT,
    "mbiEligFlag" BOOLEAN,
    "mbiFee" DECIMAL(12,2),
    "mbiIncome" DECIMAL(12,2),
    "mbiLimit" INTEGER,
    "mbiLimitMax" TEXT,
    "mbiName" TEXT,
    "mbiTerm" INTEGER,
    "mbiPolicyNo" TEXT,
    "mbiPurchaseCost" DECIMAL(12,2),

    CONSTRAINT "SaleInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleSalesPerson" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "assnSlsperson" TEXT,
    "billingClerk" TEXT,
    "closingMgr" TEXT,
    "deliveryCoord" TEXT,
    "fiMgr1" TEXT,
    "fiMgr2" TEXT,
    "salesMgr" TEXT,
    "salesperson1" TEXT,
    "salesperson2" TEXT,
    "salesperson3" TEXT,

    CONSTRAINT "SaleSalesPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleTax" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "serviceTaxAmount" DECIMAL(12,2),
    "leaseFlexibleTax1Amount" DECIMAL(12,2),
    "leaseFlexibleTax2Amount" DECIMAL(12,2),
    "goodsAndServicesTaxDetails" JSONB,
    "luxuryTaxDetails" JSONB,
    "salesTaxDetails" JSONB,
    "purchaseFlexibleTaxDetails" JSONB,
    "taxCommonDetails" JSONB,

    CONSTRAINT "SaleTax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleTotal" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "totalTradeAllowance" DECIMAL(12,2),
    "totalTradesACV" DECIMAL(12,2),
    "totalTradesNet" DECIMAL(12,2),
    "totalTradesOver" DECIMAL(12,2),
    "totalTradesPayoff" DECIMAL(12,2),
    "totalAnnFees" DECIMAL(12,2),
    "totalBackCostAdjustments" DECIMAL(12,2),
    "totalBasePrice" DECIMAL(12,2),
    "totalCapReduction" DECIMAL(12,2),
    "totalCashSurplus" DECIMAL(12,2),
    "totalCommission" DECIMAL(12,2),
    "totalDMVLicenseFeeCalifornia" DECIMAL(12,2),
    "totalDown" DECIMAL(12,2),
    "totalFinancedFeeOptions" DECIMAL(12,2),
    "totalFrontCostAdjustments" DECIMAL(12,2),
    "totalInsurancePremiums" DECIMAL(12,2),
    "totalGross" DECIMAL(12,2),
    "totalInitFees" DECIMAL(12,2),
    "totalOfMonthlyPayments" DECIMAL(12,2),
    "totalOptionsFees" DECIMAL(12,2),
    "totalTaxableFees" DECIMAL(12,2),
    "totalTaxRate" DECIMAL(8,4),
    "weOweCostTotal" DECIMAL(12,2),
    "weOweSaleTotal" DECIMAL(12,2),
    "tax" DECIMAL(12,2),

    CONSTRAINT "SaleTotal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleTrade" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "netTrade" DECIMAL(12,2),
    "tradeACV" TEXT,
    "tradeColor" TEXT,
    "tradeGross" DECIMAL(12,2),
    "tradeMake" TEXT,
    "tradeMakeName" TEXT,
    "tradeMileage" TEXT,
    "tradeModel" TEXT,
    "tradeModelName" TEXT,
    "tradeModelNo" TEXT,
    "tradeModelType" TEXT,
    "tradeOver" DECIMAL(12,2),
    "tradePayOff" TEXT,
    "tradeStock" TEXT,
    "tradeStyle" TEXT,
    "tradeVIN" TEXT,
    "tradeYear" INTEGER,
    "orderIndex" INTEGER,
    "tradeDealerDefined1" TEXT,
    "tradeDealerDefined2" TEXT,
    "tradeDealerDefined3" TEXT,
    "tradeDealerDefined4" TEXT,
    "tradeDealerDefined5" TEXT,
    "tradeDealerDefined6" TEXT,
    "tradeDealerDefined7" TEXT,
    "tradeDealerDefined8" TEXT,

    CONSTRAINT "SaleTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleVehicle" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "saleDataId" UUID NOT NULL,
    "vin" TEXT,
    "make" TEXT,
    "makeName" TEXT,
    "model" TEXT,
    "modelName" TEXT,
    "modelNo" TEXT,
    "modelType" TEXT,
    "year" INTEGER,
    "age" INTEGER,
    "bodyStyle" TEXT,
    "color" TEXT,
    "stockNo" TEXT,
    "vehicleMileage" INTEGER,
    "vehInventoryCompany" TEXT,
    "vehSaleCompany" TEXT,
    "glVehicleCost" DECIMAL(12,2),

    CONSTRAINT "SaleVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleData_dealNo_key" ON "SaleData"("dealNo");

-- CreateIndex
CREATE INDEX "idx_sale_dealer" ON "SaleData"("dealerId");

-- CreateIndex
CREATE INDEX "idx_sale_deal_no" ON "SaleData"("dealNo");

-- CreateIndex
CREATE INDEX "idx_sale_status" ON "SaleData"("status");

-- CreateIndex
CREATE INDEX "idx_sale_status_date" ON "SaleData"("dealStatusDate");

-- CreateIndex
CREATE UNIQUE INDEX "SaleCommission_saleDataId_key" ON "SaleCommission"("saleDataId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleDeal_saleDataId_key" ON "SaleDeal"("saleDataId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleDealAuxiliary_saleDataId_key" ON "SaleDealAuxiliary"("saleDataId");

-- CreateIndex
CREATE INDEX "idx_sale_event_sale" ON "SaleDealEvent"("saleDataId");

-- CreateIndex
CREATE INDEX "idx_sale_fee_sale" ON "SaleFee"("saleDataId");

-- CreateIndex
CREATE INDEX "idx_sale_fee_type" ON "SaleFee"("feeType");

-- CreateIndex
CREATE UNIQUE INDEX "SaleIncentive_saleDataId_key" ON "SaleIncentive"("saleDataId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleInsurance_saleDataId_key" ON "SaleInsurance"("saleDataId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleSalesPerson_saleDataId_key" ON "SaleSalesPerson"("saleDataId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleTax_saleDataId_key" ON "SaleTax"("saleDataId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleTotal_saleDataId_key" ON "SaleTotal"("saleDataId");

-- CreateIndex
CREATE INDEX "idx_sale_trade_sale" ON "SaleTrade"("saleDataId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleVehicle_saleDataId_key" ON "SaleVehicle"("saleDataId");

-- CreateIndex
CREATE INDEX "idx_sale_veh_vin" ON "SaleVehicle"("vin");

-- CreateIndex
CREATE INDEX "idx_sale_veh_make_model" ON "SaleVehicle"("make", "model");

-- AddForeignKey
ALTER TABLE "SaleData" ADD CONSTRAINT "fk_sale_dealer" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleCommission" ADD CONSTRAINT "fk_sale_comm_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleDeal" ADD CONSTRAINT "fk_sale_deal_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleDealAuxiliary" ADD CONSTRAINT "fk_sale_aux_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleDealEvent" ADD CONSTRAINT "fk_sale_event_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleFee" ADD CONSTRAINT "fk_sale_fee_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleIncentive" ADD CONSTRAINT "fk_sale_inc_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleInsurance" ADD CONSTRAINT "fk_sale_ins_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleSalesPerson" ADD CONSTRAINT "fk_sale_sp_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleTax" ADD CONSTRAINT "fk_sale_tax_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleTotal" ADD CONSTRAINT "fk_sale_total_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleTrade" ADD CONSTRAINT "fk_sale_trade_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaleVehicle" ADD CONSTRAINT "fk_sale_veh_sale" FOREIGN KEY ("saleDataId") REFERENCES "SaleData"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
