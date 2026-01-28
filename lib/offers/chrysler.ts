import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const fetchModelInfos = async () => {
  const response = await fetch(
    "https://www.chrysler.com/xfragments/chrysler-vsp-isilo-master/incentives.dataprops.ISiloVehicleSelector.isilovehicleselector.par.V1765779863779.json",
    {
      method: "GET",
      redirect: "follow" as RequestRedirect,
    },
  );

  if (!response.ok) {
    console.error("Failed to fetch model infos:", response.status);
    return null;
  }

  const data = await response.json();
  const modelInfos = data.vehicleSelector.vehicleSelectorGrids[0].vehicleSelectorCards.flatMap(
    (card: any) => {
      return card.modelYearData.map((yearData: any) => {
        return {
          key: yearData.authoring.url,
          year: yearData.modelData.year,
          brand: yearData.modelData.brand,
          vehicle: yearData.modelData.vehicle,
          modelYearCode: yearData.modelData.modelYearCode,
          displayName: yearData.modelData.display,
          msrp: yearData.modelData.msrp,
          ccode: yearData.modelData.ccode,
        };
      });
    },
  );
  return modelInfos;
};

const fetChOfferData = async (modelInfo: any) => {
  const url = `https://www.chrysler.com/hostd/api/incentives/offers/targetMedium/iSilo-Inline/zip/95556/vehicle/${modelInfo.modelYearCode}`;
  const requestOptions = {
    method: "GET",
    redirect: "follow" as RequestRedirect,
  };
  const response = await fetch(url, requestOptions);
  if (!response.ok) {
    console.error("Failed to fetch model info:", response.status);
    throw new Error(`Failed to fetch model info: ${await response.text()}`);
  }
  const responseData = await response.json();
  const data = responseData?.data;

  if (!data || !data.targetMediumMapping || !Array.isArray(data.targetMediumMapping)) {
    console.warn(`No offers data found for model ${modelInfo.modelYearCode}`);
    return [];
  }

  if (!data.offers || !Array.isArray(data.offers)) {
    console.warn(`No offers array found for model ${modelInfo.modelYearCode}`);
    return [];
  }

  const offers = data.targetMediumMapping.flatMap((item: any) => {
    if (!item.offerOrder || !Array.isArray(item.offerOrder)) {
      return [];
    }
    return item.offerOrder
      .map((offer: any) => {
        const offerInfo = data.offers.find((info: any) => info.id === offer.id);
        if (!offerInfo) {
          console.error("Offer info not found:", offer.id);
          return null;
        }

        // Extract trim from representativeCcode
        const trim = offer.representativeCcode?.description || null;

        // Determine offer type
        const offerType =
          offerInfo.type === "UserPlus" ? "lease" : offerInfo.type === "APR" ? "financing" : "cash";

        // Extract APR and term for financing offers
        let aprRate: number | null = null;
        let aprTermMonths: number | null = null;
        if (offerInfo.type === "APR") {
          const aprProgram = offerInfo.programValues?.find(
            (pv: any) => pv.displayType === "apr" && pv.apr,
          );
          if (aprProgram) {
            aprRate = aprProgram.apr / 100;
            aprTermMonths = aprProgram.term;
          }
        }

        // Extract cash back for cash offers
        let cashValue: number | null = null;
        if (offerInfo.type === "CASH") {
          const cashPrograms = offerInfo.programValues?.filter(
            (pv: any) => pv.displayType === "cash" && pv.value,
          );
          if (cashPrograms && cashPrograms.length > 0) {
            cashValue = cashPrograms.reduce((sum: number, pv: any) => sum + (pv.value || 0), 0);
          }
        }

        // Extract lease details for UserPlus offers
        let leaseMonthlyPayment: number | null = null;
        let leaseDueAtSigning: number | null = null;
        let milesPerYear: number | null = null;
        let leaseTermMonths: number | null = null;
        if (offerInfo.type === "UserPlus") {
          const leaseGroup = offerInfo.groupData?.find((gd: any) => gd.type === "LEASE");
          if (leaseGroup) {
            leaseMonthlyPayment = leaseGroup.monthlyPmnt
              ? parseFloat(leaseGroup.monthlyPmnt)
              : null;
            leaseDueAtSigning = leaseGroup.dueatSigning
              ? parseFloat(leaseGroup.dueatSigning)
              : null;
            milesPerYear = leaseGroup.mileage || null;
            leaseTermMonths = leaseGroup.numberofPmnts ? parseInt(leaseGroup.numberofPmnts) : null;
          }
          // Also check offer.term and offer.mileage as fallback
          if (!leaseTermMonths && offer.term) {
            leaseTermMonths = parseInt(offer.term);
          }
          if (!milesPerYear && offer.mileage) {
            milesPerYear = offer.mileage;
          }
        }

        // Extract expiration date
        const expirationDate = offerInfo.end ? new Date(offerInfo.end).toISOString() : null;

        return {
          brand: "Chrysler",
          year: modelInfo.year,
          make: "Chrysler",
          model: modelInfo.vehicle,
          modelCode: modelInfo.modelYearCode,
          trim: trim,
          offerType: offerType,
          offerAmount: null,
          aprRate: aprRate,
          aprTermMonths: aprTermMonths,
          leaseTermMonths: leaseTermMonths,
          cashValue: cashValue,
          tradeDiscount: null, // Not found in response structure
          leaseDueAtSigning: leaseDueAtSigning,
          leaseMonthlyPayment: leaseMonthlyPayment,
          milesPerYear: milesPerYear,
          terms: offerInfo.offerDescription || null,
          finePrint: offerInfo.offerDisclaimer
            ? offerInfo.offerDisclaimer
                .replace(/&lt;br\/&gt;/gi, "\n")
                .replace(/<br\s*\/?>/gi, "\n")
            : null,
          expirationDate: expirationDate,
        };
      })
      .filter((offer: any) => offer !== null);
  });
  return offers;
};

export async function scrapeOffersFromChrysler() {
  try {
    await prisma.$connect();
    const modelInfos = await fetchModelInfos();
    if (!modelInfos) {
      console.error("Failed to fetch model infos");
      return { success: false, error: "Failed to fetch model infos" };
    }
    const offers = [];
    for (const modelInfo of modelInfos) {
      const offerData = await fetChOfferData(modelInfo);
      offers.push(...offerData);
    }
    if (offers.length > 0) {
      await prisma.offers.deleteMany({
        where: {
          brand: "Chrysler",
        },
      });
      console.log("Deleted all existing Chrysler offers");
      const BATCH_SIZE = 10;
      for (let i = 0; i < offers.length; i += BATCH_SIZE) {
        const batch = offers.slice(i, i + BATCH_SIZE);
        try {
          await prisma.$transaction(async (tx) => {
            await tx.offers.createMany({
              data: batch.map((offer) => ({
                brand: offer.brand,
                year: offer.year ? parseInt(offer.year) : null,
                make: offer.make,
                model: offer.model,
                modelCode: offer.modelCode,
                trim: offer.trim,
                offerType: offer.offerType,
                offerAmount: offer.offerAmount,
                aprRate:
                  offer.aprRate !== null && offer.aprRate !== undefined ? offer.aprRate : null,
                aprTermMonths:
                  offer.aprTermMonths !== null && offer.aprTermMonths !== undefined
                    ? offer.aprTermMonths
                    : null,
                leaseTermMonths:
                  offer.leaseTermMonths !== null && offer.leaseTermMonths !== undefined
                    ? offer.leaseTermMonths
                    : null,
                cashValue:
                  offer.cashValue !== null && offer.cashValue !== undefined
                    ? offer.cashValue
                    : null,
                tradeDiscount: offer.tradeDiscount,
                leaseDueAtSigning:
                  offer.leaseDueAtSigning !== null && offer.leaseDueAtSigning !== undefined
                    ? offer.leaseDueAtSigning
                    : null,
                leaseMonthlyPayment:
                  offer.leaseMonthlyPayment !== null && offer.leaseMonthlyPayment !== undefined
                    ? offer.leaseMonthlyPayment
                    : null,
                milesPerYear:
                  offer.milesPerYear !== null && offer.milesPerYear !== undefined
                    ? offer.milesPerYear
                    : null,
                terms: offer.terms,
                finePrint: offer.finePrint,
                expirationDate: offer.expirationDate ? new Date(offer.expirationDate) : null,
                scrapedAt: new Date(),
              })),
              skipDuplicates: true,
            });
          });
        } catch (err: any) {
          console.error("Error storing Chrysler offer batch:", err?.message || err);
        }
      }
    }
    console.log("Chrysler Offers found:", offers.length);
    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Chrysler offers:", error?.message || error);
    return { success: false, error: error?.message || "Failed to scrape Chrysler offers" };
  }
}
