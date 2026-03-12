import {
  createScrapeEvent,
  markScrapeEventFailed,
  storeScrapedIncentives,
  type NormalizedIncentiveOffer,
} from "@/lib/incentives/storeScrapedIncentives";

// Parse number from string, removing commas, dollar signs, and other formatting
function parseNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  try {
    const strValue = typeof str === "string" ? str : String(str);
    const cleaned = strValue.replace(/[,$%]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

// Extract dollar amount near a keyword (e.g. "$500 military" or "loyalty bonus $500") for schema bonus/discount fields
function extractAmountNearKeyword(
  text: string | null | undefined,
  keyword: RegExp,
): number | null {
  if (!text) return null;
  try {
    const afterKeyword = new RegExp(
      `${keyword.source}[\\s\\S]{0,80}?\\$([\\d,]+)`,
      "i",
    );
    let match = text.match(afterKeyword);
    if (match && match[1]) return parseNumber(match[1]);
    const beforeKeyword = new RegExp(
      `\\$([\\d,]+)[\\s\\S]{0,80}?${keyword.source}`,
      "i",
    );
    match = text.match(beforeKeyword);
    if (match && match[1]) return parseNumber(match[1]);
    return null;
  } catch {
    return null;
  }
}

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
  const sourceUrl = `https://www.dodge.com${modelInfo.url}`;
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
        let cashValue: number | null = null;
        if (offerType === "cash") {
          const cashPrograms = offerInfo.programValues?.filter(
            (pv: any) => pv.displayType === "cash" && pv.value,
          );
          if (cashPrograms && cashPrograms.length > 0) {
            cashValue = cashPrograms.reduce((sum: number, pv: any) => sum + (pv.value || 0), 0);
          }
        }
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
          if (!leaseTermMonths && offer.term) {
            leaseTermMonths = parseInt(offer.term);
          }
          if (!milesPerYear && offer.mileage) {
            milesPerYear = offer.mileage;
          }
        }
        const expirationDate = offerInfo.end ? new Date(offerInfo.end).toISOString() : null;

        // Extract trim from representativeCcode
        const trim = offer.representativeCcode?.description || null;

        // Combine terms + finePrint for bonus/discount extraction (API has no structured fields)
        const termsText = offerInfo.offerDescription || "";
        const finePrintText = offerInfo.offerDisclaimer
          ? offerInfo.offerDisclaimer
              .replace(/&lt;br\/&gt;/gi, "\n")
              .replace(/<br\s*\/?>/gi, "\n")
          : "";
        const combinedText = [termsText, finePrintText].filter(Boolean).join("\n");

        const loyaltyBonus = extractAmountNearKeyword(combinedText, /loyalty\s*(?:bonus|cash|rebate)?/i);
        const conquestBonus = extractAmountNearKeyword(combinedText, /conquest\s*(?:bonus|cash|rebate)?/i);
        const militaryDiscount = extractAmountNearKeyword(combinedText, /military\s*(?:discount|bonus|rebate)?/i);
        const collegeGrad = extractAmountNearKeyword(combinedText, /college\s*(?:grad|graduate|rebate|bonus)?/i);
        const firstResponder = extractAmountNearKeyword(combinedText, /first\s*responder\s*(?:discount|bonus|rebate)?/i);

        return {
          brand: "dodge",
          year: modelInfo.year,
          make: "dodge",
          model: modelInfo.displayName,
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
          sourceUrl: sourceUrl,
          loyaltyBonus: loyaltyBonus ?? null,
          conquestBonus: conquestBonus ?? null,
          militaryDiscount: militaryDiscount ?? null,
          collegeGrad: collegeGrad ?? null,
          firstResponder: firstResponder ?? null,
        };
      });
    })
    .filter((offer: any) => offer !== null);
  return offers;
};

export async function scrapeOffersFromDodge() {
  const { scrapeEventId } = await createScrapeEvent({
    brand: "Dodge",
    source: "dodge",
  });
  try {
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
    console.log("Dodge incentives found:", offers.length);

    const result = await storeScrapedIncentives({
      brand: offers.length > 0 ? offers[0].brand : "Dodge",
      offers: offers as NormalizedIncentiveOffer[],
      source: "dodge",
      scrapeEventId,
    });
    if (!result.success) {
      return { success: false, totalOffers: 0, error: result.error };
    }
    return { success: true, totalOffers: result.stored };
  } catch (error: any) {
    console.error("Error scraping Dodge offers:", error?.message || error);
    const message = error?.message || "Failed to scrape Dodge offers";
    await markScrapeEventFailed(scrapeEventId, message, {
      brand: "Dodge",
      source: "dodge",
    });
    return { success: false, error: message };
  }
}
