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

// Map program number to bonus category using data.programs (name / incentiveType)
function getBonusCategory(program: { name?: string; incentiveType?: string } | null): string | null {
  if (!program) return null;
  const name = (program.name || "").toLowerCase();
  const incentiveType = (program.incentiveType || "").toLowerCase();
  const combined = `${name} ${incentiveType}`;
  if (combined.includes("loyalty")) return "loyalty";
  if (combined.includes("conquest")) return "conquest";
  if (combined.includes("military")) return "military";
  if (combined.includes("college") || combined.includes("graduate")) return "college";
  if (combined.includes("first responder")) return "firstResponder";
  return null;
}

// Extract bonus/discount amounts from offer's programValues using data.programs (structured API data)
function getStructuredBonuses(
  offerInfo: { programValues?: Array<{ programCode?: string; value?: number }> },
  programs: Array<{ programNumber?: string; name?: string; incentiveType?: string }> | undefined,
): {
  loyaltyBonus: number | null;
  conquestBonus: number | null;
  militaryDiscount: number | null;
  collegeGrad: number | null;
  firstResponder: number | null;
} {
  const result = {
    loyaltyBonus: null as number | null,
    conquestBonus: null as number | null,
    militaryDiscount: null as number | null,
    collegeGrad: null as number | null,
    firstResponder: null as number | null,
  };
  if (!programs || !Array.isArray(offerInfo.programValues)) return result;
  const programByNumber = new Map(
    programs.map((p) => [p.programNumber, p]),
  );
  for (const pv of offerInfo.programValues) {
    const value = pv.value != null ? Number(pv.value) : null;
    if (value == null || value <= 0) continue;
    const program = programByNumber.get(pv.programCode) ?? null;
    const category = getBonusCategory(program);
    if (category === "loyalty" && result.loyaltyBonus == null) result.loyaltyBonus = value;
    else if (category === "conquest" && result.conquestBonus == null) result.conquestBonus = value;
    else if (category === "military" && result.militaryDiscount == null)
      result.militaryDiscount = value;
    else if (category === "college" && result.collegeGrad == null) result.collegeGrad = value;
    else if (category === "firstResponder" && result.firstResponder == null)
      result.firstResponder = value;
  }
  return result;
}

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
  const url = `https://www.jeep.com/hostd/api/incentives/offers/targetMedium/iSilo-Inline/zip/95556/vehicle/${modelInfo.modelYearCode}`;
  const sourceUrl = `https://www.jeep.com${modelInfo.url}`;
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

  // Preprocess data.offers into offersList: each item has id, offerType, and all extracted fields
  const offersList = data.offers.map((offerInfo: any) => {
    const offerType =
      offerInfo.type === "UserPlus" ? "lease" : offerInfo.type === "APR" ? "financing" : "cash";

    let aprRate: number | null = null;
    let aprTermMonths: number | null = null;
    if (offerInfo.type === "APR") {
      const aprProgram = offerInfo.programValues?.find(
        (pv: any) => pv.displayType === "apr" && typeof pv.apr === "number",
      );
      if (aprProgram) {
        aprRate = aprProgram.apr / 100;
        aprTermMonths = aprProgram.term;
      }
    }

    let cashValue: number | null = null;
    if (offerInfo.type === "CASH") {
      const cashPrograms = offerInfo.programValues?.filter(
        (pv: any) => pv.displayType === "cash" && pv.value,
      );
      if (cashPrograms && cashPrograms.length > 0) {
        cashValue = cashPrograms.reduce((sum: number, pv: any) => sum + (pv.value || 0), 0);
      }
      if (cashValue == null) {
        const cashGroup = offerInfo.groupData?.find((gd: any) => gd.type === "Cash");
        if (cashGroup?.value && typeof cashGroup.value === "string") {
          cashValue = parseNumber(cashGroup.value);
        }
      }
    }

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
    }

    const expirationDate = offerInfo.end ? new Date(offerInfo.end).toISOString() : null;

    const structured = getStructuredBonuses(offerInfo, data.programs);
    const termsText = offerInfo.offerDescription || "";
    const finePrintText = offerInfo.offerDisclaimer
      ? offerInfo.offerDisclaimer
          .replace(/&lt;br\/&gt;/gi, "\n")
          .replace(/<br\s*\/?>/gi, "\n")
      : "";
    const combinedText = [termsText, finePrintText].filter(Boolean).join("\n");

    const loyaltyBonus =
      structured.loyaltyBonus ??
      extractAmountNearKeyword(combinedText, /loyalty\s*(?:bonus|cash|rebate)?/i);
    const conquestBonus =
      structured.conquestBonus ??
      extractAmountNearKeyword(combinedText, /conquest\s*(?:bonus|cash|rebate)?/i);
    const militaryDiscount =
      structured.militaryDiscount ??
      extractAmountNearKeyword(combinedText, /military\s*(?:discount|bonus|rebate)?/i);
    const collegeGrad =
      structured.collegeGrad ??
      extractAmountNearKeyword(combinedText, /college\s*(?:grad|graduate|rebate|bonus)?/i);
    const firstResponder =
      structured.firstResponder ??
      extractAmountNearKeyword(combinedText, /first\s*responder\s*(?:discount|bonus|rebate)?/i);

    return {
      id: offerInfo.id,
      offerType,
      offerAmount: null,
      aprRate,
      aprTermMonths,
      leaseTermMonths,
      cashValue,
      tradeDiscount: null,
      leaseDueAtSigning,
      leaseMonthlyPayment,
      milesPerYear,
      terms: offerInfo.offerDescription || null,
      finePrint: offerInfo.offerDisclaimer
        ? offerInfo.offerDisclaimer
            .replace(/&lt;br\/&gt;/gi, "\n")
            .replace(/<br\s*\/?>/gi, "\n")
        : null,
      expirationDate,
      loyaltyBonus: loyaltyBonus ?? null,
      conquestBonus: conquestBonus ?? null,
      militaryDiscount: militaryDiscount ?? null,
      collegeGrad: collegeGrad ?? null,
      firstResponder: firstResponder ?? null,
    };
  });

  const offers = data.targetMediumMapping.flatMap((item: any) => {
    if (!item.offerOrder || !Array.isArray(item.offerOrder)) {
      return [];
    }
    return item.offerOrder
      .map((offer: any) => {
        const preprocessed = offersList.find((o: { id: string }) => o.id === offer.id);
        if (!preprocessed) {
          console.error("Offer info not found:", offer.id);
          return null;
        }

        const trim = offer.representativeCcode?.description || null;
        // Lease fallbacks from offer order (term, mileage)
        const leaseTermMonths =
          preprocessed.leaseTermMonths ??
          (offer.term ? parseInt(offer.term) : null);
        const milesPerYear =
          preprocessed.milesPerYear ?? (offer.mileage ?? null);

        return {
          brand: "Jeep",
          year: modelInfo.year,
          make: "Jeep",
          model: modelInfo.vehicle,
          modelCode: modelInfo.modelYearCode,
          trim,
          sourceUrl,
          leaseTermMonths,
          milesPerYear,
          ...preprocessed,
        };
      })
      .filter((offer: any) => offer !== null);
  });
  return offers;
};

export async function scrapeOffersFromJeep() {
  const { scrapeEventId } = await createScrapeEvent({
    brand: "Jeep",
    source: "jeep",
  });
  try {
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

    console.log("Jeep incentives found:", offers.length);

    const result = await storeScrapedIncentives({
      brand: "Jeep",
      offers: offers as NormalizedIncentiveOffer[],
      source: "jeep",
      scrapeEventId,
    });
    if (!result.success) {
      return { success: false, totalOffers: 0, error: result.error };
    }
    return { success: true, totalOffers: result.stored };
  } catch (error: any) {
    console.error("Error scraping Jeep offers:", error?.message || error);
    const message = error?.message || "Failed to scrape Jeep offers";
    await markScrapeEventFailed(scrapeEventId, message, {
      brand: "Jeep",
      source: "jeep",
    });
    return { success: false, error: message };
  }
}
