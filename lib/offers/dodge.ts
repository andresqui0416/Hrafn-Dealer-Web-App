import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const fetchModelInfos = async () => {
  const response = await fetch(
    "https://www.dodge.com/xfragments/dodge-vsp-isilo-master/incentives.dataprops.ISiloVehicleSelector.isilovehicleselector.par.V1765309358341.json",
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
          modelYearCode: yearData.modelData.modelYearCode,
          year: yearData.modelData.year,
          brand: yearData.modelData.brand,
          vehicle: yearData.modelData.vehicle,
          displayName: yearData.modelData.display,
          ccode: yearData.modelData.ccode,
        };
      });
    });
  });
  return modelInfos;
};

const fetchOfferData = async (modelInfo: any) => {
  const response = await fetch(
    `https://www.dodge.com/hostd/api/incentives/offers/targetMedium/Preferred-Offers/zip/95556/vehicle/${modelInfo.modelYearCode}`,
    {
      method: "GET",
      redirect: "follow" as RequestRedirect,
    },
  );
  if (!response.ok) {
    console.error("Failed to fetch offer data:", response.status);
    return null;
  }
  const data = (await response.json())?.data;
  if (!data || !data.targetMediumMapping || !Array.isArray(data.targetMediumMapping)) {
    console.warn("No targetMediumMapping found in response data");
    return [];
  }
  const offers = data.targetMediumMapping
    .flatMap((item: any) => {
      if (!item.offerOrder || !Array.isArray(item.offerOrder)) {
        return [];
      }
      return item.offerOrder.map((offer: any) => {
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
        const offerInfo = data?.offers?.find((info: any) => info.id === offer.id);
        if (!offerInfo) {
          console.error("Offer info not found:", offer.id);
          return null;
        }
        let apr: number | null = null;
        let termMonths: number | null = null;
        if (offerType === "financing") {
          const aprProgram = offerInfo.programValues?.find(
            (pv: any) => pv.displayType === "apr" && typeof pv.apr === "number",
          );
          if (aprProgram) {
            apr = aprProgram.apr / 100;
            termMonths = aprProgram.term;
          }
        }
        let cashBack: number | null = null;
        if (offerType === "cash") {
          const cashPrograms = offerInfo.programValues?.filter(
            (pv: any) => pv.displayType === "cash" && pv.value,
          );
          if (cashPrograms && cashPrograms.length > 0) {
            cashBack = cashPrograms.reduce((sum: number, pv: any) => sum + (pv.value || 0), 0);
          }
        }
        let monthlyPayment: number | null = null;
        let dueAtSigning: number | null = null;
        let milesPerYear: number | null = null;
        if (offerType === "lease") {
          const leaseGroup = offerInfo.groupData?.find((gd: any) => gd.type === "LEASE");
          if (leaseGroup) {
            monthlyPayment = leaseGroup.monthlyPmnt ? parseFloat(leaseGroup.monthlyPmnt) : null;
            dueAtSigning = leaseGroup.dueatSigning ? parseFloat(leaseGroup.dueatSigning) : null;
            milesPerYear = leaseGroup.mileage || null;
            termMonths = leaseGroup.numberofPmnts ? parseInt(leaseGroup.numberofPmnts) : null;
          }
        }
        const expirationDate = offerInfo.end ? new Date(offerInfo.end).toISOString() : null;

        // Extract trim from representativeCcode
        const trim = offer.representativeCcode?.description || null;

        return {
          brand: "dodge",
          year: modelInfo.year,
          make: "dodge",
          model: modelInfo.displayName,
          modelCode: modelInfo.modelYearCode,
          trim: trim,
          offerType: offerType,
          offerAmount: null,
          apr: apr,
          termMonths: termMonths,
          cashBack: cashBack,
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
      });
    })
    .filter((offer: any) => offer !== null);
  return offers;
};

export async function scrapeOffersFromDodge() {
  try {
    await prisma.$connect();
    const modelInfos = await fetchModelInfos();
    if (!modelInfos) {
      return { success: false, error: "Failed to fetch model infos" };
    }
    console.log("Model infos fetched successfully:", modelInfos.length);
    const offers = [];
    for (const modelInfo of modelInfos) {
      const offerData = await fetchOfferData(modelInfo);
      offers.push(...offerData);
    }
    console.log("Offers fetched successfully:", offers.length);
    if (offers.length > 0) {
      await prisma.offers.deleteMany({
        where: {
          brand: "dodge",
        },
      });
      console.log("Deleted all existing Dodge offers");
      const BATCH_SIZE = 10;
      for (let i = 0; i < offers.length; i += BATCH_SIZE) {
        const batch = offers.slice(i, i + BATCH_SIZE);
        try {
          await prisma.$transaction(async (tx) => {
            await tx.offers.createMany({
              data: batch.map((offer) => ({
                brand: "dodge",
                year: offer.year ? parseInt(offer.year) : null,
                make: "dodge",
                model: offer.model,
                modelCode: offer.modelCode,
                trim: offer.trim || null,
                offerType: offer.offerType,
                offerAmount: offer.offerAmount,
                apr: offer.apr,
                termMonths: offer.termMonths,
                cashBack: offer.cashBack,
                dueAtSigning: offer.dueAtSigning,
                monthlyPayment: offer.monthlyPayment,
                milesPerYear: offer.milesPerYear,
                terms: offer.terms,
                finePrint: offer.finePrint,
                expirationDate: offer.expirationDate ? new Date(offer.expirationDate) : null,
                scrapedAt: new Date(),
              })),
              skipDuplicates: true,
            });
          });
        } catch (err: any) {
          console.error("Error storing Dodge offer batch:", err?.message || err);
        }
      }
    }
    console.log("Offers fetched successfully:", offers.length);
    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Dodge offers:", error?.message || error);
    return { success: false, error: error?.message || "Failed to scrape Dodge offers" };
  } finally {
    await prisma.$disconnect();
  }
}
