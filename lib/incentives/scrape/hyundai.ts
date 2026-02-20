import {
  createScrapeEvent,
  markScrapeEventFailed,
  storeScrapedIncentives,
  type NormalizedIncentiveOffer,
} from "@/lib/incentives/storeScrapedIncentives";

// Public-facing URL for Hyundai offers (stored in DB)
const HYUNDAI_SOURCE_URL = "https://www.hyundaiusa.com/us/en/offers";

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

// Parse date from MM/DD/YYYY format
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }
    return null;
  } catch {
    return null;
  }
}

// Extract due at signing amount from text (e.g., "with $3,999 due at lease signing")
function extractDueAtSigning(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/\$([\d,]+)\s+due\s+at\s+(lease\s+)?signing/i);
    if (match) {
      return parseNumber(match[1]);
    }
    return null;
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

interface HyundaiOffer {
  brand: string;
  year: number | null;
  make: string;
  model: string;
  modelCode: string | null;
  trim: string | null;
  offerType: "lease" | "financing" | "cash";
  offerAmount: number | null;
  aprRate: number | null;
  aprTermMonths: number | null;
  leaseTermMonths: number | null;
  cashValue: number | null;
  tradeDiscount: number | null;
  leaseDueAtSigning: number | null;
  leaseMonthlyPayment: number | null;
  milesPerYear: number | null;
  terms: string | null;
  finePrint: string | null;
  expirationDate: Date | null;
  scrapedAt: Date;
  sourceUrl: string | null;
  loyaltyBonus: number | null;
  conquestBonus: number | null;
  militaryDiscount: number | null;
  collegeGrad: number | null;
  firstResponder: number | null;
}

export async function scrapeOffersFromHyundai(zipCode: string = "95556") {
  const { scrapeEventId } = await createScrapeEvent({
    brand: "Hyundai",
    source: "hyundai",
  });
  try {
    const url = `https://www.hyundaiusa.com/var/hyundai/services/incentiveAws.featuredOfferByZip.service?brand=hyundai&zip=${zipCode}`;

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Hyundai API error:", response.status, text.substring(0, 500));
      throw new Error(`Hyundai API request failed: ${response.status}`);
    }

    const text = await response.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse Hyundai API response as JSON:", text.substring(0, 500));
      throw new Error("Invalid JSON response from Hyundai API");
    }

    if (!data?.data || !Array.isArray(data.data)) {
      console.error("Unexpected API response structure:", data);
      return { success: false, error: "Unexpected API response structure" };
    }

    const offers: HyundaiOffer[] = [];
    const scrapedAt = new Date();

    // Process each data item (typically one per state/region)
    for (const dataItem of data.data) {
      const years = dataItem.years || [];

      // Process each year
      for (const yearData of years) {
        const modelYear = yearData.modelYear;
        const vehicles = yearData.vehicles || [];

        // Process each vehicle
        for (const vehicle of vehicles) {
          const modelName = vehicle.modelName || "";
          const modelGroupCode = vehicle.modelGroupCode || null;
          const cardOrder = vehicle.cardOrder || {};

          // Process lease1 offer
          if (cardOrder.lease1) {
            const lease1 = cardOrder.lease1;
            const dueAtSigning = extractDueAtSigning(lease1.header || lease1.shortDescription);
            const termsText = lease1.shortDescription || "";
            const finePrintText = lease1.disclaimer || "";
            const combinedText = [termsText, finePrintText].filter(Boolean).join("\n");
            const loyaltyBonus = extractAmountNearKeyword(combinedText, /loyalty\s*(?:bonus|cash|rebate)?/i);
            const conquestBonus = extractAmountNearKeyword(combinedText, /conquest\s*(?:bonus|cash|rebate)?/i);
            const militaryDiscount = extractAmountNearKeyword(combinedText, /military\s*(?:discount|bonus|rebate)?/i);
            const collegeGrad = extractAmountNearKeyword(combinedText, /college\s*(?:grad|graduate|rebate|bonus)?/i);
            const firstResponder = extractAmountNearKeyword(combinedText, /first\s*responder\s*(?:discount|bonus|rebate)?/i);

            offers.push({
              brand: "Hyundai",
              year: modelYear,
              make: "Hyundai",
              model: modelName,
              modelCode: modelGroupCode,
              trim: lease1.trimName || null,
              offerType: "lease",
              offerAmount: null,
              aprRate: null,
              aprTermMonths: null,
              leaseTermMonths: lease1.term || null,
              cashValue: null,
              tradeDiscount: null,
              leaseDueAtSigning: dueAtSigning,
              leaseMonthlyPayment: lease1.offerMonthlyPayment || null,
              milesPerYear: null,
              terms: lease1.shortDescription || null,
              finePrint: lease1.disclaimer || null,
              expirationDate: parseDate(lease1.endDate),
              scrapedAt,
              sourceUrl: HYUNDAI_SOURCE_URL,
              loyaltyBonus: loyaltyBonus ?? null,
              conquestBonus: conquestBonus ?? null,
              militaryDiscount: militaryDiscount ?? null,
              collegeGrad: collegeGrad ?? null,
              firstResponder: firstResponder ?? null,
            });
          }

          // Process lease2 offer
          if (cardOrder.lease2) {
            const lease2 = cardOrder.lease2;
            const dueAtSigning = extractDueAtSigning(lease2.header || lease2.shortDescription);
            const termsText = lease2.shortDescription || "";
            const finePrintText = lease2.disclaimer || "";
            const combinedText = [termsText, finePrintText].filter(Boolean).join("\n");
            const loyaltyBonus = extractAmountNearKeyword(combinedText, /loyalty\s*(?:bonus|cash|rebate)?/i);
            const conquestBonus = extractAmountNearKeyword(combinedText, /conquest\s*(?:bonus|cash|rebate)?/i);
            const militaryDiscount = extractAmountNearKeyword(combinedText, /military\s*(?:discount|bonus|rebate)?/i);
            const collegeGrad = extractAmountNearKeyword(combinedText, /college\s*(?:grad|graduate|rebate|bonus)?/i);
            const firstResponder = extractAmountNearKeyword(combinedText, /first\s*responder\s*(?:discount|bonus|rebate)?/i);

            offers.push({
              brand: "Hyundai",
              year: modelYear,
              make: "Hyundai",
              model: modelName,
              modelCode: modelGroupCode,
              trim: lease2.trimName || null,
              offerType: "lease",
              offerAmount: null,
              aprRate: null,
              aprTermMonths: null,
              leaseTermMonths: lease2.term || null,
              cashValue: null,
              tradeDiscount: null,
              leaseDueAtSigning: dueAtSigning,
              leaseMonthlyPayment: lease2.offerMonthlyPayment || null,
              milesPerYear: null,
              terms: lease2.shortDescription || null,
              finePrint: lease2.disclaimer || null,
              expirationDate: parseDate(lease2.endDate),
              scrapedAt,
              sourceUrl: HYUNDAI_SOURCE_URL,
              loyaltyBonus: loyaltyBonus ?? null,
              conquestBonus: conquestBonus ?? null,
              militaryDiscount: militaryDiscount ?? null,
              collegeGrad: collegeGrad ?? null,
              firstResponder: firstResponder ?? null,
            });
          }

          // Process lowApr (financing) offer
          if (cardOrder.lowApr) {
            const lowApr = cardOrder.lowApr;
            const aprRate =
              lowApr.apr !== undefined && lowApr.apr !== null ? lowApr.apr / 100 : null;
            const termsText = lowApr.shortDescription || "";
            const finePrintText = lowApr.disclaimer || "";
            const combinedText = [termsText, finePrintText].filter(Boolean).join("\n");
            const loyaltyBonus = extractAmountNearKeyword(combinedText, /loyalty\s*(?:bonus|cash|rebate)?/i);
            const conquestBonus = extractAmountNearKeyword(combinedText, /conquest\s*(?:bonus|cash|rebate)?/i);
            const militaryDiscount = extractAmountNearKeyword(combinedText, /military\s*(?:discount|bonus|rebate)?/i);
            const collegeGrad = extractAmountNearKeyword(combinedText, /college\s*(?:grad|graduate|rebate|bonus)?/i);
            const firstResponder = extractAmountNearKeyword(combinedText, /first\s*responder\s*(?:discount|bonus|rebate)?/i);

            offers.push({
              brand: "Hyundai",
              year: modelYear,
              make: "Hyundai",
              model: modelName,
              modelCode: modelGroupCode,
              trim: lowApr.trimName || null,
              offerType: "financing",
              offerAmount: null,
              aprRate,
              aprTermMonths: lowApr.term || null,
              leaseTermMonths: null,
              cashValue: lowApr.hmfBonusCash || null,
              tradeDiscount: null,
              leaseDueAtSigning: null,
              leaseMonthlyPayment: null,
              milesPerYear: null,
              terms: lowApr.shortDescription || null,
              finePrint: lowApr.disclaimer || null,
              expirationDate: parseDate(lowApr.endDate),
              scrapedAt,
              sourceUrl: HYUNDAI_SOURCE_URL,
              loyaltyBonus: loyaltyBonus ?? null,
              conquestBonus: conquestBonus ?? null,
              militaryDiscount: militaryDiscount ?? null,
              collegeGrad: collegeGrad ?? null,
              firstResponder: firstResponder ?? null,
            });
          }

          // Process savings (cash) offer
          if (cardOrder.savings) {
            const savings = cardOrder.savings;
            const termsText = savings.shortDescription || "";
            const finePrintText = savings.disclaimer || "";
            const combinedText = [termsText, finePrintText].filter(Boolean).join("\n");
            const loyaltyBonus = extractAmountNearKeyword(combinedText, /loyalty\s*(?:bonus|cash|rebate)?/i);
            const conquestBonus = extractAmountNearKeyword(combinedText, /conquest\s*(?:bonus|cash|rebate)?/i);
            const militaryDiscount = extractAmountNearKeyword(combinedText, /military\s*(?:discount|bonus|rebate)?/i);
            const collegeGrad = extractAmountNearKeyword(combinedText, /college\s*(?:grad|graduate|rebate|bonus)?/i);
            const firstResponder = extractAmountNearKeyword(combinedText, /first\s*responder\s*(?:discount|bonus|rebate)?/i);

            offers.push({
              brand: "Hyundai",
              year: modelYear,
              make: "Hyundai",
              model: modelName,
              modelCode: modelGroupCode,
              trim: savings.trimName || null,
              offerType: "cash",
              offerAmount: null,
              aprRate: null,
              aprTermMonths: null,
              leaseTermMonths: null,
              cashValue: savings.price || null,
              tradeDiscount: null,
              leaseDueAtSigning: null,
              leaseMonthlyPayment: null,
              milesPerYear: null,
              terms: savings.shortDescription || null,
              finePrint: savings.disclaimer || null,
              expirationDate: parseDate(savings.endDate),
              scrapedAt,
              sourceUrl: HYUNDAI_SOURCE_URL,
              loyaltyBonus: loyaltyBonus ?? null,
              conquestBonus: conquestBonus ?? null,
              militaryDiscount: militaryDiscount ?? null,
              collegeGrad: collegeGrad ?? null,
              firstResponder: firstResponder ?? null,
            });
          }
        }
      }
    }

    console.log("Hyundai incentives found:", offers.length);

    const result = await storeScrapedIncentives({
      brand: "Hyundai",
      offers: offers as NormalizedIncentiveOffer[],
      source: "hyundai",
      scrapeEventId,
    });
    if (!result.success) {
      return { success: false, totalOffers: 0, error: result.error };
    }
    return { success: true, totalOffers: result.stored };
  } catch (error: any) {
    console.error("Error scraping Hyundai offers:", error);
    const message = error?.message || "Internal server error while scraping Hyundai offers";
    await markScrapeEventFailed(scrapeEventId, message, {
      brand: "Hyundai",
      source: "hyundai",
    });
    return { success: false, error: message };
  }
}
