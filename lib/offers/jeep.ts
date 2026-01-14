import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const fetchModelInfos = async () => {
  const response = await fetch(
    "https://www.jeep.com/xfragments/iSilo-VSP-Container/isilo-container.dataprops.ISiloVehicleSelector.isilovehicleselector_393942471.par.V1766135743256.json",
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
  const modelInfos = data.vehicleSelector.vehicleSelectorGrids.flatMap((item: any) => {
    return item.vehicleSelectorCards.flatMap((card: any) => {
      return card.modelYearData.map((yearData: any) => {
        return {
          url: yearData.authoring.url,
          year: yearData.modelData.year,
          brand: yearData.modelData.brand,
          vehicle: yearData.modelData.vehicle,
          modelYearCode: yearData.modelData.modelYearCode,
          displayName: yearData.modelData.display,
          msrp: yearData.modelData.msrp,
          ccode: yearData.modelData.ccode,
        };
      });
    });
  });
  return modelInfos;
};

const fetchOfferData = async (modelInfo: any) => {
  const url = `https://www.jeep.com/hostd/api/incentives/offers/targetMedium/Preferred-Offers/zip/95556/vehicle/${modelInfo.modelYearCode}`;
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
        let apr: number | null = null;
        let termMonths: number | null = null;
        if (offerInfo.type === "APR") {
          const aprProgram = offerInfo.programValues?.find(
            (pv: any) => pv.displayType === "apr" && typeof pv.apr === "number",
          );
          if (aprProgram) {
            apr = aprProgram.apr / 100;
            termMonths = aprProgram.term;
          } else {
            console.log(offerInfo.programValues);
          }
        }

        // Extract cash back for cash offers
        let cashBack: number | null = null;
        if (offerInfo.type === "CASH") {
          const cashPrograms = offerInfo.programValues?.filter(
            (pv: any) => pv.displayType === "cash" && pv.value,
          );
          if (cashPrograms && cashPrograms.length > 0) {
            cashBack = cashPrograms.reduce((sum: number, pv: any) => sum + (pv.value || 0), 0);
          }
        }

        // Extract lease details for UserPlus offers
        let monthlyPayment: number | null = null;
        let dueAtSigning: number | null = null;
        let milesPerYear: number | null = null;
        if (offerInfo.type === "UserPlus") {
          const leaseGroup = offerInfo.groupData?.find((gd: any) => gd.type === "LEASE");
          if (leaseGroup) {
            monthlyPayment = leaseGroup.monthlyPmnt ? parseFloat(leaseGroup.monthlyPmnt) : null;
            dueAtSigning = leaseGroup.dueatSigning ? parseFloat(leaseGroup.dueatSigning) : null;
            milesPerYear = leaseGroup.mileage || null;
            termMonths = leaseGroup.numberofPmnts ? parseInt(leaseGroup.numberofPmnts) : null;
          }
          // Also check offer.term and offer.mileage as fallback
          if (!termMonths && offer.term) {
            termMonths = parseInt(offer.term);
          }
          if (!milesPerYear && offer.mileage) {
            milesPerYear = offer.mileage;
          }
        }

        // Extract expiration date
        const expirationDate = offerInfo.end ? new Date(offerInfo.end).toISOString() : null;

        return {
          brand: "Jeep",
          year: modelInfo.year,
          make: "Jeep",
          model: modelInfo.vehicle,
          modelCode: modelInfo.modelYearCode,
          trim: trim,
          offerType: offerType,
          offerAmount: null,
          apr: apr,
          termMonths: termMonths,
          cashBack: cashBack,
          tradeDiscount: null, // Not found in response structure
          dueAtSigning: dueAtSigning,
          monthlyPayment: monthlyPayment,
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

export async function scrapeOffersFromJeep() {
  try {
    await prisma.$connect();
    const modelInfos = await fetchModelInfos();
    if (!modelInfos) {
      console.error("Failed to fetch model infos");
      return { success: false, error: "Failed to fetch model infos" };
    }
    console.log("Model infos fetched successfully:", modelInfos.length);
    const offers = [];
    for (const modelInfo of modelInfos) {
      try {
        const offerData = await fetchOfferData(modelInfo);
        offers.push(...offerData);
      } catch (err: any) {
        console.error(
          `Error fetching offers for model ${modelInfo.modelYearCode}:`,
          err?.message || err,
        );
      }
    }
    if (offers.length > 0) {
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
                apr: offer.apr !== null && offer.apr !== undefined ? offer.apr : null,
                termMonths:
                  offer.termMonths !== null && offer.termMonths !== undefined
                    ? offer.termMonths
                    : null,
                cashBack:
                  offer.cashBack !== null && offer.cashBack !== undefined ? offer.cashBack : null,
                tradeDiscount: offer.tradeDiscount,
                dueAtSigning:
                  offer.dueAtSigning !== null && offer.dueAtSigning !== undefined
                    ? offer.dueAtSigning
                    : null,
                monthlyPayment:
                  offer.monthlyPayment !== null && offer.monthlyPayment !== undefined
                    ? offer.monthlyPayment
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
          console.error("Error storing Jeep offer batch:", err?.message || err);
        }
      }
    }
    console.log("Offers fetched successfully:", offers.length);
    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Jeep offers:", error?.message || error);
    return { success: false, error: error?.message || "Failed to scrape Jeep offers" };
  }
}
