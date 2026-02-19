import { storeScrapedIncentives, type NormalizedIncentiveOffer } from "@/lib/incentives/storeScrapedIncentives";

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
    "https://www.ramtrucks.com/xfragments/ramtrucks-vsp-isilo-master/incentives.dataprops.ISiloVehicleSelector.isilovehicleselector.par.V1769726152065.json",
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
  const modelInfos = data.vehicleSelector.vehicleSelectorGrids[0].vehicleSelectorCards.flatMap((item: any) => {
    return item.modelYearData.map((yearData: any) => {
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
  return modelInfos;
};

const fetchOfferData = async (modelInfo: any) => {
  const sourceUrl = `https://www.ramtrucks.com${modelInfo.url}`;
  const url = `https://www.ramtrucks.com/hostd/api/incentives/offers/targetMedium/iSilo-Inline/zip/95556/vehicle/${modelInfo.modelYearCode}`;
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
      })
      .filter((offer: any) => offer !== null);
  });
  return offers;
};

export async function scrapeOffersFromRAM() {
  try {
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
    console.log("RAM incentives found:", offers.length);

    const result = await storeScrapedIncentives({
      brand: "RAM",
      offers: offers as NormalizedIncentiveOffer[],
      source: "ram",
    });
    if (!result.success) {
      return { success: false, totalOffers: 0, error: result.error };
    }
    return { success: true, totalOffers: result.stored };
  } catch (err: any) {
    console.error("Error scraping RAM offers:", err?.message || err);
    return { success: false, error: err?.message || err };
  }
}
