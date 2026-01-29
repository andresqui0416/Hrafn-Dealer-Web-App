import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const fetchModelInfos = async () => {
  const response = await fetch(
    "https://www.ramtrucks.com/hostd/api/incentives/offers/targetMedium/Preferred-Offers/zip/95556/vehicle/T",
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
  const modelInfos = data.data.targetMediumMapping.flatMap((item: any) => {
    if (!item.offerOrder || !Array.isArray(item.offerOrder)) {
      return [];
    }
    if (!item.offerOrder[0].representativeCcode) {
      return [];
    }

    return {
      key: item.key,
      year: item.offerOrder[0].representativeCcode.year,
      modelYearCode: item.offerOrder[0].representativeCcode.ccode,
      modelDesc: item.offerOrder[0].representativeCcode.modelDesc,
    };
  });
  return modelInfos;
};

const fetchOfferData = async (modelInfo: any) => {
  const url = `https://www.ramtrucks.com/hostd/api/incentives/offers/targetMedium/iSilo-Inline/zip/95556/vehicle/${modelInfo.key}`;
  const requestOptions = {
    method: "GET",
    redirect: "follow" as RequestRedirect,
  };
  const response = await fetch(url, requestOptions);
  if (!response.ok) {
    console.error("Failed to fetch offer data:", response.status);
    return [];
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
        // Determine offer type
        let offerType: string | null = null;
        switch (offer.label) {
          case "Lease":
            offerType = "lease";
            break;
          case "Finance":
            offerType = "financing";
            break;
          case "Cash":
            offerType = "cash";
            break;
          default:
            return null;
        }
        const offerInfo = data.offers.find((info: any) => info.id === offer.id);
        if (!offerInfo) {
          console.error("Offer info not found:", offer.id);
          return null;
        }

        // Extract trim from representativeCcode
        const trim = offer.representativeCcode?.description || null;

        // Extract APR and term for financing offers
        let aprRate: number | null = null;
        let aprTermMonths: number | null = null;
        if (offerType === "financing") {
          const aprProgram = offerInfo.programValues?.find(
            (pv: any) => pv.displayType === "apr" && typeof pv.apr === "number",
          );
          if (aprProgram) {
            aprRate = aprProgram.apr / 100;
            aprTermMonths = aprProgram.term;
          }
        }

        // Extract cash back for cash offers
        let cashValue: number | null = null;
        if (offerType === "cash") {
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
        if (offerType === "lease") {
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
          brand: "RAM",
          year: modelInfo.year,
          make: "RAM",
          model: modelInfo.modelDesc,
          modelCode: modelInfo.modelYearCode,
          trim: trim,
          offerType: offerType,
          offerAmount: null,
          aprRate: aprRate,
          aprTermMonths: aprTermMonths,
          leaseTermMonths: leaseTermMonths,
          cashValue: cashValue,
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

export async function scrapeOffersFromRAM() {
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
      const offerData = await fetchOfferData(modelInfo);
      offers.push(...offerData);
    }
    if (offers.length > 0) {
      await prisma.offers.deleteMany({
        where: {
          brand: "RAM",
        },
      });
      console.log("Deleted all existing RAM offers");

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
                aprRate: offer.aprRate,
                aprTermMonths: offer.aprTermMonths,
                leaseTermMonths: offer.leaseTermMonths,
                cashValue: offer.cashValue,
                leaseDueAtSigning: offer.leaseDueAtSigning,
                leaseMonthlyPayment: offer.leaseMonthlyPayment,
                milesPerYear: offer.milesPerYear,
                terms: offer.terms,
                finePrint: offer.finePrint,
                expirationDate: offer.expirationDate,
                scrapedAt: new Date(),
                sourceUrl: offer.sourceUrl ?? null,
              })),
              skipDuplicates: true,
            });
          });
        } catch (err: any) {
          console.error("Error storing RAM offer batch:", err?.message || err);
        }
      }
    }
    return { success: true, totalOffers: offers.length };
  } catch (err: any) {
    console.error("Error scraping RAM offers:", err?.message || err);
    return { success: false, error: err?.message || err };
  } finally {
    await prisma.$disconnect();
  }
}
