import { PrismaClient, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

/**
 * Transform and store sales data from CDK API into database
 * @param salesDataArray - Array of sales data from CDK API
 * @param dealerId - Dealer ID to associate with sales
 * @returns Results object with created, updated, and error counts
 */
export async function storeSalesData(salesDataArray: any[], dealerId: string) {
  const results = {
    created: 0,
    updated: 0,
    errors: 0,
  };

  for (const saleData of salesDataArray) {
    try {
      // Extract dealNo - required field
      const dealNo = saleData.deal?.dealNo || saleData.dealNo;
      if (!dealNo) {
        console.warn("Skipping sale data: missing dealNo", saleData);
        results.errors++;
        continue;
      }

      // Check if sale data already exists
      const existingSaleData = await prisma.saleData.findUnique({
        where: { dealNo },
      });

      // Prepare main SaleData record
      const saleDataRecord: Prisma.SaleDataCreateInput = {
        dealer: { connect: { id: dealerId } },
        dealNo,
        status: saleData.status || saleData.deal?.dealStatus || null,
        dealStatusDate: saleData.dealStatusDate
          ? new Date(saleData.dealStatusDate)
          : saleData.deal?.dealStatusDate
            ? new Date(saleData.deal.dealStatusDate)
            : null,
        changedDate: saleData.changedDate ? new Date(saleData.changedDate) : null,
      };

      // Prepare nested relations
      const nestedData: Partial<Prisma.SaleDataCreateInput> = {};

      // Commission
      if (saleData.commission) {
        const comm = saleData.commission;
        nestedData.commission = {
          create: {
            commissionGross: comm.commissionGross ? new Decimal(comm.commissionGross) : null,
            commissionPack: comm.commissionPack ? new Decimal(comm.commissionPack) : null,
            commOnSaleDlr: comm.commOnSaleDlr ? new Decimal(comm.commOnSaleDlr) : null,
            surplusCash: comm.surplusCash ? new Decimal(comm.surplusCash) : null,
            optionsCommDlr: comm.optionsCommDlr ? new Decimal(comm.optionsCommDlr) : null,
            commissionsBase: comm.commissionsBase || null,
            sp1Bonus: comm.sp1Bonus ? new Decimal(comm.sp1Bonus) : null,
            sp1Commission: comm.sp1Commission || null,
            sp1SaleCreditSP: comm.sp1SaleCreditSP || null,
            sp1SurplusCash: comm.sp1SurplusCash || null,
            sp1TotalCommission: comm.sp1TotalCommission
              ? new Decimal(comm.sp1TotalCommission)
              : null,
            sp2Bonus: comm.sp2Bonus ? new Decimal(comm.sp2Bonus) : null,
            sp2Commission: comm.sp2Commission || null,
            sp2SaleCreditSP: comm.sp2SaleCreditSP || null,
            sp2SurplusCash: comm.sp2SurplusCash || null,
            sp2TotalCommission: comm.sp2TotalCommission
              ? new Decimal(comm.sp2TotalCommission)
              : null,
            sp2PurchaseMBISPCommAmount: comm.sp2PurchaseMBISPCommAmount
              ? new Decimal(comm.sp2PurchaseMBISPCommAmount)
              : null,
            sp3Bonus: comm.sp3Bonus ? new Decimal(comm.sp3Bonus) : null,
            sp3Commission: comm.sp3Commission || null,
            sp3SaleCreditSP: comm.sp3SaleCreditSP || null,
            sp3SurplusCash: comm.sp3SurplusCash || null,
          },
        };
      }

      // Deal
      if (saleData.deal) {
        const deal = saleData.deal;
        const parseDecimal = (val: any) => (val != null ? new Decimal(val) : null);
        const parseDate = (val: any) => (val ? new Date(val) : null);
        const parseInteger = (val: any) => (val != null ? parseInt(String(val), 10) : null);

        nestedData.deal = {
          create: {
            dealNo: deal.dealNo || null,
            accountingAccount: deal.accountingAccount || null,
            accountingDate: parseDate(deal.accountingDate),
            branch: deal.branch || null,
            contractDate: parseDate(deal.contractDate),
            creationDate: parseDate(deal.creationDate),
            salesDate: parseDate(deal.salesDate),
            adjustedCapCost: parseDecimal(deal.adjustedCapCost),
            adjustedCostofVehicle: parseDecimal(deal.adjustedCostofVehicle),
            adjustmentsDealerDefined: parseDecimal(deal.adjustmentsDealerDefined),
            adjustmentsROPO: parseDecimal(deal.adjustmentsROPO),
            adjustmentsStandard: parseDecimal(deal.adjustmentsStandard),
            amountDueAtStart: parseDecimal(deal.amountDueAtStart),
            apr: parseDecimal(deal.apr),
            backGross: parseDecimal(deal.backGross),
            balloonAmount: parseDecimal(deal.balloonAmount),
            balloonRate: deal.balloonRate || null,
            bankFee: deal.bankFee || null,
            baseMSRP: deal.baseMSRP || null,
            msrpFee1: deal.msrpFee1 || null,
            msrpFee2: deal.msrpFee2 || null,
            baseResidual: parseDecimal(deal.baseResidual),
            buyRateAddOn: parseDecimal(deal.buyRateAddOn),
            buyRateAPR: parseDecimal(deal.buyRateAPR),
            buyRateLMF: deal.buyRateLMF || null,
            calcMethod: deal.calcMethod || null,
            cashCapReduction: parseDecimal(deal.cashCapReduction),
            capCostReductionTax2Amount: parseDecimal(deal.capCostReductionTax2Amount),
            cashDown: deal.cashDown || null,
            cashPrice: parseDecimal(deal.cashPrice),
            costPrice: parseDecimal(deal.costPrice),
            customerCashDown: parseDecimal(deal.customerCashDown),
            customerComments: deal.customerComments || null,
            depositAmount: deal.depositAmount || null,
            depositType: deal.depositType || null,
            dmvRosNumber: deal.dmvRosNumber || null,
            dueOnDelivery: parseDecimal(deal.dueOnDelivery),
            fiDealType: deal.fiDealType || null,
            fiIncome: parseDecimal(deal.fiIncome),
            financeAmt: parseDecimal(deal.financeAmt),
            financeCharge: parseDecimal(deal.financeCharge),
            financeSource: deal.financeSource || null,
            finInstituteCode: deal.finInstituteCode || null,
            firstPayDate: parseDate(deal.firstPayDate),
            fiWipStatusCode: deal.fiWipStatusCode || null,
            frontEndGrossProfit: parseDecimal(deal.frontEndGrossProfit),
            frontGross: parseDecimal(deal.frontGross),
            grossProfit: parseDecimal(deal.grossProfit),
            hostItemId: deal.hostItemId || null,
            initialCapCost: deal.initialCapCost || null,
            lastPayAmount: parseDecimal(deal.lastPayAmount),
            lastPayDate: parseDate(deal.lastPayDate),
            leaseEndPercentageRate: parseDecimal(deal.leaseEndPercentageRate),
            leaseEndValue: parseDecimal(deal.leaseEndValue),
            leaseMileageAllowance: parseDecimal(deal.leaseMileageAllowance),
            leasePayment: deal.leasePayment || null,
            leaseType: deal.leaseType || null,
            levelizedLifeAmount: parseDecimal(deal.levelizedLifeAmount),
            levelizedLifeCost: deal.levelizedLifeCost || null,
            levelizedLifeIncome: deal.levelizedLifeIncome || null,
            lienHolderAddress: deal.lienHolderAddress || null,
            lienHolderCity: deal.lienHolderCity || null,
            lienHolderName: deal.lienHolderName || null,
            lienHolderName2: deal.lienHolderName2 || null,
            lienHolderPhone: deal.lienHolderPhone || null,
            lienHolderState: deal.lienHolderState || null,
            lienHolderZip: deal.lienHolderZip || null,
            mileageExpected: parseInteger(deal.mileageExpected),
            mileageExpectedFlag: deal.mileageExpectedFlag || null,
            mileageMonthlyLimit: deal.mileageMonthlyLimit || null,
            mileagePenaltyAmount: parseDecimal(deal.mileagePenaltyAmount),
            mileagePenaltyRate: parseDecimal(deal.mileagePenaltyRate),
            miscellaneous1: deal.miscellaneous1 || null,
            miscellaneous2: deal.miscellaneous2 || null,
            miscellaneous3: deal.miscellaneous3 || null,
            miscellaneous4: deal.miscellaneous4 || null,
            miscellaneous5: deal.miscellaneous5 || null,
            miscellaneous6: deal.miscellaneous6 || null,
            miscellaneous7: deal.miscellaneous7 || null,
            miscellaneous8: deal.miscellaneous8 || null,
            miscellaneous9: deal.miscellaneous9 || null,
            miscellaneous10: deal.miscellaneous10 || null,
            dealerDefined1: deal.dealerDefined1 || null,
            dealerDefined2: deal.dealerDefined2 || null,
            dealerDefined3: deal.dealerDefined3 || null,
            dealerDefined4: deal.dealerDefined4 || null,
            dealerDefined5: deal.dealerDefined5 || null,
            dealerDefined6: deal.dealerDefined6 || null,
            dealerDefined7: deal.dealerDefined7 || null,
            dealerDefined8: deal.dealerDefined8 || null,
            msrp: parseDecimal(deal.msrp),
            onePayAmount: deal.onePayAmount || null,
            outTheDoorPrice: parseDecimal(deal.outTheDoorPrice),
            paymentAmt: parseDecimal(deal.paymentAmt),
            paymentCode: deal.paymentCode || null,
            payments: parseInteger(deal.payments),
            paymentStyle: deal.paymentStyle || null,
            pickupPay1: deal.pickupPay1 || null,
            pickupDate1: parseDate(deal.pickupDate1),
            pickupPay2: deal.pickupPay2 || null,
            pickupDate2: parseDate(deal.pickupDate2),
            pickupPay3: deal.pickupPay3 || null,
            pickupDate3: parseDate(deal.pickupDate3),
            salePriceWithWeOwes: parseDecimal(deal.salePriceWithWeOwes),
            salesAccount: deal.salesAccount || null,
            salesManagementDealType: deal.salesManagementDealType || null,
            saleType: deal.saleType || null,
            securityDepositAmount: parseDecimal(deal.securityDepositAmount),
            securityDepositName: deal.securityDepositName || null,
            sellRateAddOn: parseDecimal(deal.sellRateAddOn),
            sellRateAPR: deal.sellRateAPR || null,
            sellRateLMF: deal.sellRateLMF || null,
            slsDealType: deal.slsDealType || null,
            term: parseInteger(deal.term),
            unpaidBalance: parseDecimal(deal.unpaidBalance),
            waqNumber: deal.waqNumber || null,
            dealSource: deal.dealSource || null,
            dealType: deal.dealType || null,
          },
        };
      }

      // DealAuxiliary
      if (saleData.dealAuxiliary) {
        const aux = saleData.dealAuxiliary;
        nestedData.dealAuxiliary = {
          create: {
            fiAux1: aux.fiAux1 || null,
            fiAux2: aux.fiAux2 || null,
            fiAux3: aux.fiAux3 || null,
            fiAux4: aux.fiAux4 || null,
            fiAux5: aux.fiAux5 || null,
            fiAux6: aux.fiAux6 || null,
            fiAux7: aux.fiAux7 || null,
            fiAux8: aux.fiAux8 || null,
            fiAux9: aux.fiAux9 || null,
            fiAux10: aux.fiAux10 || null,
            fiAux11: aux.fiAux11 || null,
            fiAux12: aux.fiAux12 || null,
            fiAux13: aux.fiAux13 || null,
            fiAux14: aux.fiAux14 || null,
            fiAux15: aux.fiAux15 || null,
            fiAux16: aux.fiAux16 || null,
            fiAux17: aux.fiAux17 || null,
            fiAux18: aux.fiAux18 || null,
            fiAux19: aux.fiAux19 || null,
            fiAux20: aux.fiAux20 || null,
            fiAux21: aux.fiAux21 || null,
            fiAux22: aux.fiAux22 || null,
            fiAux23: aux.fiAux23 || null,
            fiAux24: aux.fiAux24 || null,
            fiAux25: aux.fiAux25 || null,
            fiAux26: aux.fiAux26 || null,
            fiAux27: aux.fiAux27 || null,
            fiAux28: aux.fiAux28 || null,
            fiAux29: aux.fiAux29 || null,
            fiAux30: aux.fiAux30 || null,
            fiAux31: aux.fiAux31 || null,
            fiAux32: aux.fiAux32 || null,
            fiAux33: aux.fiAux33 || null,
            fiAux34: aux.fiAux34 || null,
            fiAux35: aux.fiAux35 || null,
            fiAux36: aux.fiAux36 || null,
            fiAux37: aux.fiAux37 || null,
            fiAux38: aux.fiAux38 || null,
            fiAux39: aux.fiAux39 || null,
            fiAux40: aux.fiAux40 || null,
            fiAux41: aux.fiAux41 || null,
            fiAux42: aux.fiAux42 || null,
            fiAux43: aux.fiAux43 || null,
            fiAux44: aux.fiAux44 || null,
            fiAux45: aux.fiAux45 || null,
            fiAux46: aux.fiAux46 || null,
            fiAux47: aux.fiAux47 || null,
            fiAux48: aux.fiAux48 || null,
            fiAux49: aux.fiAux49 || null,
            fiAux50: aux.fiAux50 || null,
          },
        };
      }

      // DealEvents
      if (saleData.dealEvents && Array.isArray(saleData.dealEvents)) {
        nestedData.dealEvents = {
          create: saleData.dealEvents.map((event: any, index: number) => ({
            specialContract1Date: event.specialContract1Date
              ? new Date(event.specialContract1Date)
              : null,
            specialContract1Reason: event.specialContract1Reason || null,
            specialContract2Date: event.specialContract2Date
              ? new Date(event.specialContract2Date)
              : null,
            specialContract2Reason: event.specialContract2Reason || null,
            dealEvent: event.dealEvent || null,
            dealEventDate: event.dealEventDate ? new Date(event.dealEventDate) : null,
            eventOrder: event.eventOrder || index + 1,
          })),
        };
      }

      // Fees
      if (saleData.fees && Array.isArray(saleData.fees)) {
        nestedData.fees = {
          create: saleData.fees.map((fee: any, index: number) => ({
            feeType: fee.feeType || "feeOption",
            amount: fee.amount ? new Decimal(fee.amount) : null,
            name: fee.name || null,
            costAmount: fee.costAmount ? new Decimal(fee.costAmount) : null,
            profitType: fee.profitType || null,
            flag: fee.flag ?? null,
            orderIndex: fee.orderIndex || index + 1,
          })),
        };
      }

      // Incentives
      if (saleData.incentives) {
        const inc = saleData.incentives;
        nestedData.incentives = {
          create: {
            incentiveDealer: inc.incentiveDealer ? new Decimal(inc.incentiveDealer) : null,
            incentiveProgram: inc.incentiveProgram ? new Decimal(inc.incentiveProgram) : null,
            rebateAmount: inc.rebateAmount ? new Decimal(inc.rebateAmount) : null,
            commonRebateDetails: inc.commonRebateDetails || null,
          },
        };
      }

      // Insurance
      if (saleData.insurance) {
        const ins = saleData.insurance;
        nestedData.insurance = {
          create: {
            extWarrantyExpMilesLease:
              ins.extWarrantyExpMilesLease != null
                ? parseInt(String(ins.extWarrantyExpMilesLease), 10)
                : null,
            extWarrantyTermLease:
              ins.extWarrantyTermLease != null
                ? parseInt(String(ins.extWarrantyTermLease), 10)
                : null,
            insuranceTypeCode: ins.insuranceTypeCode || null,
            texasGAPInsuranceAmount: ins.texasGAPInsuranceAmount
              ? new Decimal(ins.texasGAPInsuranceAmount)
              : null,
            insurance1: ins.insurance1 || null,
            insurance2: ins.insurance2 || null,
            insurance3: ins.insurance3 || null,
            ahiCost: ins.ahiCost ? new Decimal(ins.ahiCost) : null,
            ahiIncome: ins.ahiIncome ? new Decimal(ins.ahiIncome) : null,
            ahiMonthlyMaxAmount: ins.ahiMonthlyMaxAmount
              ? new Decimal(ins.ahiMonthlyMaxAmount)
              : null,
            ahiPremium: ins.ahiPremium ? new Decimal(ins.ahiPremium) : null,
            ahiRate: ins.ahiRate ? new Decimal(ins.ahiRate) : null,
            ahiTerm: ins.ahiTerm != null ? parseInt(String(ins.ahiTerm), 10) : null,
            cliCost: ins.cliCost ? new Decimal(ins.cliCost) : null,
            cliIncome: ins.cliIncome ? new Decimal(ins.cliIncome) : null,
            cliMonthlyMaxAmount: ins.cliMonthlyMaxAmount
              ? new Decimal(ins.cliMonthlyMaxAmount)
              : null,
            cliPremium: ins.cliPremium ? new Decimal(ins.cliPremium) : null,
            cliRate: ins.cliRate ? new Decimal(ins.cliRate) : null,
            cliTerm: ins.cliTerm != null ? parseInt(String(ins.cliTerm), 10) : null,
            cliInsuranceType: ins.cliInsuranceType || null,
            mbiCarrier: ins.mbiCarrier || null,
            mbiCost: ins.mbiCost ? new Decimal(ins.mbiCost) : null,
            mbiDeductible: ins.mbiDeductible ? new Decimal(ins.mbiDeductible) : null,
            mbiEligComment: ins.mbiEligComment || null,
            mbiEligFlag: ins.mbiEligFlag ?? null,
            mbiFee: ins.mbiFee ? new Decimal(ins.mbiFee) : null,
            mbiIncome: ins.mbiIncome ? new Decimal(ins.mbiIncome) : null,
            mbiLimit: ins.mbiLimit != null ? parseInt(String(ins.mbiLimit), 10) : null,
            mbiLimitMax: ins.mbiLimitMax || null,
            mbiName: ins.mbiName || null,
            mbiTerm: ins.mbiTerm != null ? parseInt(String(ins.mbiTerm), 10) : null,
            mbiPolicyNo: ins.mbiPolicyNo || null,
            mbiPurchaseCost: ins.mbiPurchaseCost ? new Decimal(ins.mbiPurchaseCost) : null,
          },
        };
      }

      // SalesPersons
      if (saleData.salesPersons) {
        const sp = saleData.salesPersons;
        nestedData.salesPersons = {
          create: {
            assnSlsperson: sp.assnSlsperson || null,
            billingClerk: sp.billingClerk || null,
            closingMgr: sp.closingMgr || null,
            deliveryCoord: sp.deliveryCoord || null,
            fiMgr1: sp.fiMgr1 || null,
            fiMgr2: sp.fiMgr2 || null,
            salesMgr: sp.salesMgr || null,
            salesperson1: sp.salesperson1 || null,
            salesperson2: sp.salesperson2 || null,
            salesperson3: sp.salesperson3 || null,
          },
        };
      }

      // Tax
      if (saleData.tax) {
        const tax = saleData.tax;
        nestedData.tax = {
          create: {
            serviceTaxAmount: tax.serviceTaxAmount ? new Decimal(tax.serviceTaxAmount) : null,
            leaseFlexibleTax1Amount: tax.leaseFlexibleTax1Amount
              ? new Decimal(tax.leaseFlexibleTax1Amount)
              : null,
            leaseFlexibleTax2Amount: tax.leaseFlexibleTax2Amount
              ? new Decimal(tax.leaseFlexibleTax2Amount)
              : null,
            goodsAndServicesTaxDetails: tax.goodsAndServicesTaxDetails || null,
            luxuryTaxDetails: tax.luxuryTaxDetails || null,
            salesTaxDetails: tax.salesTaxDetails || null,
            purchaseFlexibleTaxDetails: tax.purchaseFlexibleTaxDetails || null,
            taxCommonDetails: tax.taxCommonDetails || null,
          },
        };
      }

      // Totals
      if (saleData.totals) {
        const totals = saleData.totals;
        nestedData.totals = {
          create: {
            totalTradeAllowance: totals.totalTradeAllowance
              ? new Decimal(totals.totalTradeAllowance)
              : null,
            totalTradesACV: totals.totalTradesACV ? new Decimal(totals.totalTradesACV) : null,
            totalTradesNet: totals.totalTradesNet ? new Decimal(totals.totalTradesNet) : null,
            totalTradesOver: totals.totalTradesOver ? new Decimal(totals.totalTradesOver) : null,
            totalTradesPayoff: totals.totalTradesPayoff
              ? new Decimal(totals.totalTradesPayoff)
              : null,
            totalAnnFees: totals.totalAnnFees ? new Decimal(totals.totalAnnFees) : null,
            totalBackCostAdjustments: totals.totalBackCostAdjustments
              ? new Decimal(totals.totalBackCostAdjustments)
              : null,
            totalBasePrice: totals.totalBasePrice ? new Decimal(totals.totalBasePrice) : null,
            totalCapReduction: totals.totalCapReduction
              ? new Decimal(totals.totalCapReduction)
              : null,
            totalCashSurplus: totals.totalCashSurplus ? new Decimal(totals.totalCashSurplus) : null,
            totalCommission: totals.totalCommission ? new Decimal(totals.totalCommission) : null,
            totalDMVLicenseFeeCalifornia: totals.totalDMVLicenseFeeCalifornia
              ? new Decimal(totals.totalDMVLicenseFeeCalifornia)
              : null,
            totalDown: totals.totalDown ? new Decimal(totals.totalDown) : null,
            totalFinancedFeeOptions: totals.totalFinancedFeeOptions
              ? new Decimal(totals.totalFinancedFeeOptions)
              : null,
            totalFrontCostAdjustments: totals.totalFrontCostAdjustments
              ? new Decimal(totals.totalFrontCostAdjustments)
              : null,
            totalInsurancePremiums: totals.totalInsurancePremiums
              ? new Decimal(totals.totalInsurancePremiums)
              : null,
            totalGross: totals.totalGross ? new Decimal(totals.totalGross) : null,
            totalInitFees: totals.totalInitFees ? new Decimal(totals.totalInitFees) : null,
            totalOfMonthlyPayments: totals.totalOfMonthlyPayments
              ? new Decimal(totals.totalOfMonthlyPayments)
              : null,
            totalOptionsFees: totals.totalOptionsFees ? new Decimal(totals.totalOptionsFees) : null,
            totalTaxableFees: totals.totalTaxableFees ? new Decimal(totals.totalTaxableFees) : null,
            totalTaxRate: totals.totalTaxRate ? new Decimal(totals.totalTaxRate) : null,
            weOweCostTotal: totals.weOweCostTotal ? new Decimal(totals.weOweCostTotal) : null,
            weOweSaleTotal: totals.weOweSaleTotal ? new Decimal(totals.weOweSaleTotal) : null,
            tax: totals.tax ? new Decimal(totals.tax) : null,
          },
        };
      }

      // Trades
      if (saleData.trades && Array.isArray(saleData.trades)) {
        nestedData.trades = {
          create: saleData.trades.map((trade: any, index: number) => ({
            netTrade: trade.netTrade ? new Decimal(trade.netTrade) : null,
            tradeACV: trade.tradeACV || null,
            tradeColor: trade.tradeColor || null,
            tradeGross: trade.tradeGross ? new Decimal(trade.tradeGross) : null,
            tradeMake: trade.tradeMake || null,
            tradeMakeName: trade.tradeMakeName || null,
            tradeMileage: trade.tradeMileage || null,
            tradeModel: trade.tradeModel || null,
            tradeModelName: trade.tradeModelName || null,
            tradeModelNo: trade.tradeModelNo || null,
            tradeModelType: trade.tradeModelType || null,
            tradeOver: trade.tradeOver ? new Decimal(trade.tradeOver) : null,
            tradePayOff: trade.tradePayOff || null,
            tradeStock: trade.tradeStock || null,
            tradeStyle: trade.tradeStyle || null,
            tradeVIN: trade.tradeVIN || null,
            tradeYear: trade.tradeYear != null ? parseInt(String(trade.tradeYear), 10) : null,
            orderIndex: trade.orderIndex || index + 1,
            tradeDealerDefined1: trade.tradeDealerDefined1 || null,
            tradeDealerDefined2: trade.tradeDealerDefined2 || null,
            tradeDealerDefined3: trade.tradeDealerDefined3 || null,
            tradeDealerDefined4: trade.tradeDealerDefined4 || null,
            tradeDealerDefined5: trade.tradeDealerDefined5 || null,
            tradeDealerDefined6: trade.tradeDealerDefined6 || null,
            tradeDealerDefined7: trade.tradeDealerDefined7 || null,
            tradeDealerDefined8: trade.tradeDealerDefined8 || null,
          })),
        };
      }

      // Vehicle
      if (saleData.vehicle) {
        const veh = saleData.vehicle;
        nestedData.vehicle = {
          create: {
            vin: veh.vin || null,
            make: veh.make || null,
            makeName: veh.makeName || null,
            model: veh.model || null,
            modelName: veh.modelName || null,
            modelNo: veh.modelNo || null,
            modelType: veh.modelType || null,
            year: veh.year != null ? parseInt(String(veh.year), 10) : null,
            age: veh.age != null ? parseInt(String(veh.age), 10) : null,
            bodyStyle: veh.bodyStyle || null,
            color: veh.color || null,
            stockNo: veh.stockNo || null,
            vehicleMileage:
              veh.vehicleMileage != null ? parseInt(String(veh.vehicleMileage), 10) : null,
            vehInventoryCompany: veh.vehInventoryCompany || null,
            vehSaleCompany: veh.vehSaleCompany || null,
          },
        };
      }

      // Upsert the sale data with all nested relations
      if (existingSaleData) {
        // Update existing record - delete old relations and create new ones
        await prisma.$transaction([
          // Delete old relations
          prisma.saleCommission.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleDeal.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleDealAuxiliary.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleDealEvent.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleFee.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleIncentive.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleInsurance.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleSalesPerson.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleTax.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleTotal.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleTrade.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          prisma.saleVehicle.deleteMany({ where: { saleDataId: existingSaleData.id } }),
          // Update main record
          prisma.saleData.update({
            where: { id: existingSaleData.id },
            data: {
              status: saleDataRecord.status,
              dealStatusDate: saleDataRecord.dealStatusDate,
              changedDate: saleDataRecord.changedDate,
            },
          }),
        ]);

        // Create new relations
        const createData = { ...nestedData };
        await prisma.saleData.update({
          where: { id: existingSaleData.id },
          data: createData,
        });

        results.updated++;
      } else {
        // Create new record
        await prisma.saleData.create({
          data: {
            ...saleDataRecord,
            ...nestedData,
          },
        });
        results.created++;
      }
    } catch (error) {
      console.error(
        `Error storing sale data for dealNo ${saleData.deal?.dealNo || saleData.dealNo}:`,
        error,
      );
      results.errors++;
    }
  }

  return results;
}
