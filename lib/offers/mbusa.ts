import { storeScrapedIncentives, type NormalizedIncentiveOffer } from "@/lib/incentives/storeScrapedIncentives";

// Public-facing URL for Mercedes-Benz offers (stored in DB)
const MBUSA_SOURCE_URL = "https://www.mbusa.com/en/special-offers";

// function parseMBUSADate(dateStr: string | null | undefined): Date | null {
//   if (!dateStr) return null;
//   try {
//     // Try ISO format first (YYYY-MM-DD)
//     if (dateStr.includes("-")) {
//       const date = new Date(dateStr);
//       if (!isNaN(date.getTime())) return date;
//     }
//     // Try MM/DD/YYYY format
//     if (dateStr.includes("/")) {
//       const parts = dateStr.split("/");
//       if (parts.length === 3) {
//         const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
//         const day = parseInt(parts[1], 10);
//         const year = parseInt(parts[2], 10);
//         if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
//           const date = new Date(year, month, day);
//           if (!isNaN(date.getTime())) return date;
//         }
//       }
//     }
//     // Try YYYYMMDD format
//     if (dateStr.length === 8 && /^\d+$/.test(dateStr)) {
//       const year = parseInt(dateStr.substring(0, 4));
//       const month = parseInt(dateStr.substring(4, 6)) - 1;
//       const day = parseInt(dateStr.substring(6, 8));
//       const date = new Date(year, month, day);
//       if (!isNaN(date.getTime())) return date;
//     }
//     return null;
//   } catch {
//     return null;
//   }
// }

function extractExpirationDateFromText(text: string | null | undefined): Date | null {
  if (!text) return null;
  try {
    // Look for patterns like "through January 2, 2026" or "by January 2, 2026"
    const patterns = [
      /through\s+(\w+)\s+(\d+),\s+(\d{4})/i,
      /by\s+(\w+)\s+(\d+),\s+(\d{4})/i,
      /until\s+(\w+)\s+(\d+),\s+(\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const monthNames = [
          "january",
          "february",
          "march",
          "april",
          "may",
          "june",
          "july",
          "august",
          "september",
          "october",
          "november",
          "december",
        ];
        const monthName = match[1].toLowerCase();
        const month = monthNames.indexOf(monthName);
        if (month !== -1) {
          const day = parseInt(match[2], 10);
          const year = parseInt(match[3], 10);
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) return date;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

function extractTermMonths(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    // Look for lease/finance term in various formats used by Mercedes-Benz and similar sites
    const patterns: Array<{ re: RegExp; group?: number }> = [
      { re: /for\s+(\d+)\s+months?/i },
      { re: /(\d+)\s+mos?\.?\s+to\s+(\d+)\s+mos?/i, group: 2 }, // "24 mos. to 36 mos." -> use second
      { re: /(?:for\s+)?(\d+)[-\s]*(?:months?|mos?)/i }, // "36 months", "36-mos", "36 mo", "for 36 months"
      { re: /(\d+)[-\s]*month(?:\s|$|s|,|\.)/i }, // "36-month" or "36 month"
      { re: /lease\s+(?:term\s+)?(?:of\s+)?(\d+)\s+months?/i },
      { re: /(\d+)\s+months?(?:\s+lease|\s+term)?/i }, // "36 months" or "36 months lease"
    ];

    for (const { re, group = 1 } of patterns) {
      const match = text.match(re);
      if (match) {
        const term = parseInt(match[group], 10);
        if (!isNaN(term) && term > 0) return term;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Extract due at signing amount from text (e.g., "$14,783 due at signing")
function extractDueAtSigning(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/\$([\d,]+)\s+due\s+at\s+(?:lease\s+)?signing/i);
    if (match) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract miles per year from lease disclaimer text.
// Looks for explicit "X miles per year" or "X mi/year", or derives from total miles
// (e.g. "over 30,000 miles" with 36-month lease -> 10,000 mi/year).
function extractMilesPerYear(
  text: string | null | undefined,
  leaseTermMonths: number | null,
): number | null {
  if (!text) return null;
  try {
    // Strip HTML for matching
    const plain = text.replace(/<[^>]+>/g, " ");
    // Explicit miles per year: "10,000 miles per year", "12,000 mi/year", "12000 mi/yr"
    const perYearMatch = plain.match(
      /(\d{1,3}(?:,\d{3})*|\d+)\s*miles?\s+per\s+year|(\d{1,3}(?:,\d{3})*|\d+)\s*mi\s*\/\s*year|(\d{1,3}(?:,\d{3})*|\d+)\s*mi\s*\/\s*yr/i,
    );
    if (perYearMatch) {
      const num = parseNumber(perYearMatch[1] || perYearMatch[2] || perYearMatch[3]);
      if (num !== null && num > 0) return num;
    }
    // Total miles over term: "over 30,000 miles", "30,000 miles, and vehicle turn-in"
    const totalMatch = plain.match(
      /(?:over|per)\s+(\d{1,3}(?:,\d{3})*|\d+)\s*miles|(\d{1,3}(?:,\d{3})*|\d+)\s*miles,?\s+and\s+vehicle/i,
    );
    if (totalMatch && leaseTermMonths !== null && leaseTermMonths > 0) {
      const totalMiles = parseNumber(totalMatch[1] || totalMatch[2]);
      if (totalMiles !== null && totalMiles > 0) {
        const years = leaseTermMonths / 12;
        return Math.round(totalMiles / years);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Parse number from string, removing commas, dollar signs, and other formatting
function parseNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  try {
    // Handle both string and number types
    const strValue = typeof str === "string" ? str : String(str);
    const cleaned = strValue.replace(/[,$%]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

// Extract dollar amount near a keyword for schema bonus/discount fields
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

export async function scrapeOffersFromMBUSA() {
  try {
    const mbusaApiUrl =
      "https://www.mbusa.com/en/special-offers/jcr:content.filter-offer-json.html";
    const response = await fetch(mbusaApiUrl, {
      method: "GET",
      redirect: "follow",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("MBUSA API error:", response.status, text);
      throw new Error(`MBUSA API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data) {
      console.error("Unexpected API response structure: data is null or undefined");
      return { success: false, error: "Unexpected API response structure" };
    }

    const offers: any[] = [];
    const scrapedAt = new Date();

    // The response structure is: { filter: {...}, splOfferGroups: [...] }
    // Each item in splOfferGroups has offerPages array with offer summaries
    const offerGroups = data.splOfferGroups || [];

    if (offerGroups.length === 0) {
      console.error("No offer groups found in response (splOfferGroups is missing or empty)");
      return { success: false, error: "No offer groups found in response" };
    }

    // Process each offer group
    for (const group of offerGroups) {
      const offerPages = group.offerPages || [];

      // Process each offer page
      for (const offerPage of offerPages) {
        // Handle both regular offers and CPO offers
        const offerSummary = offerPage.offerSummary;
        if (!offerSummary) continue;

        // Process regular offer summary
        if (offerSummary) {
          const modelInfo = offerSummary.model;
          if (!modelInfo) continue;

          // Extract model information
          const model = modelInfo.name || null;
          const year = modelInfo.year || null;
          const modelCode = modelInfo.code || null;
          const trim = null; // Trim info not directly available in this structure

          // Extract financial details
          const leaseMonthlyPayment = offerSummary.payValue || null;
          const aprRate = offerSummary.rateValue || null; // APR is a percentage (e.g., 1.99)
          const payDescription = offerSummary.payDescription || "";
          const rateDescription = offerSummary.rateDescription || "";

          // Extract expiration date from disclaimer text
          const leasePaymentDisclaimerText =
            offerSummary.leasePaymentDisclaimerText ||
            (offerSummary.leasePaymentDisclaimer &&
              offerSummary.leasePaymentDisclaimer[0]?.disclaimerText) ||
            "";
          const leaseRateDisclaimerText =
            (offerSummary.leaseRateDisclaimer &&
              offerSummary.leaseRateDisclaimer[0]?.disclaimerText) ||
            "";
          const expirationDate =
            extractExpirationDateFromText(leasePaymentDisclaimerText) ||
            extractExpirationDateFromText(leaseRateDisclaimerText);

          // Extract terms and fine print
          const packageName = offerSummary.packageName || "";

          // Extract bonus/discount amounts from package, descriptions, and disclaimer text
          const disclaimerPlain =
            (leasePaymentDisclaimerText || "").replace(/<[^>]+>/g, " ") +
            " " +
            (leaseRateDisclaimerText || "").replace(/<[^>]+>/g, " ");
          const combinedText = [packageName, rateDescription, payDescription, disclaimerPlain]
            .filter(Boolean)
            .join(" ");
          const loyaltyBonus = extractAmountNearKeyword(
            combinedText,
            /loyalty\s*(?:bonus|cash|rebate)?/i,
          );
          const conquestBonus = extractAmountNearKeyword(
            combinedText,
            /conquest\s*(?:bonus|cash|rebate)?/i,
          );
          const militaryDiscount = extractAmountNearKeyword(
            combinedText,
            /military\s*(?:discount|bonus|rebate)?/i,
          );
          const collegeGrad = extractAmountNearKeyword(
            combinedText,
            /college\s*(?:grad|graduate|rebate|bonus)?/i,
          );
          const firstResponder = extractAmountNearKeyword(
            combinedText,
            /first\s*responder\s*(?:discount|bonus|rebate)?/i,
          );

          // Only create offer if we have at least model and year
          if (model && year) {
            // Create finance offer if APR and rate description are present
            if (aprRate !== null && rateDescription) {
              const aprTermMonths = extractTermMonths(rateDescription);
              offers.push({
                brand: "Mercedes-Benz",
                year,
                make: "Mercedes-Benz",
                model,
                modelCode,
                trim,
                offerType: "financing",
                offerAmount: null,
                aprRate: aprRate / 100, // Convert percentage to decimal (1.99 -> 0.0199)
                aprTermMonths,
                leaseTermMonths: null,
                cashValue: null,
                leaseDueAtSigning: null,
                leaseMonthlyPayment: null,
                milesPerYear: null,
                expirationDate,
                terms: packageName || rateDescription || null,
                finePrint: leaseRateDisclaimerText || null,
                scrapedAt,
                sourceUrl: MBUSA_SOURCE_URL,
                loyaltyBonus: loyaltyBonus ?? null,
                conquestBonus: conquestBonus ?? null,
                militaryDiscount: militaryDiscount ?? null,
                collegeGrad: collegeGrad ?? null,
                firstResponder: firstResponder ?? null,
              });
            }

            // Create lease offer if monthly payment and pay description are present
            if (leaseMonthlyPayment !== null && payDescription) {
              const leaseTermMonths = extractTermMonths(payDescription);
              const leaseDueAtSigning = extractDueAtSigning(payDescription);
              const milesPerYear = extractMilesPerYear(
                leasePaymentDisclaimerText,
                leaseTermMonths,
              );
              offers.push({
                brand: "Mercedes-Benz",
                year,
                make: "Mercedes-Benz",
                model,
                modelCode,
                trim,
                offerType: "lease",
                offerAmount: null,
                aprRate: null,
                aprTermMonths: null,
                leaseTermMonths,
                cashValue: null,
                leaseDueAtSigning,
                leaseMonthlyPayment,
                milesPerYear,
                expirationDate,
                terms: packageName || payDescription || null,
                finePrint: leasePaymentDisclaimerText || null,
                scrapedAt,
                sourceUrl: MBUSA_SOURCE_URL,
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
    }

    console.log("Mercedes-Benz incentives found:", offers.length);

    const result = await storeScrapedIncentives({
      brand: "Mercedes-Benz",
      offers: offers as NormalizedIncentiveOffer[],
      source: "mbusa",
    });
    if (!result.success) {
      return { success: false, totalOffers: 0, error: result.error };
    }
    return { success: true, totalOffers: result.stored };
  } catch (error: any) {
    console.error("Error scraping Mercedes-Benz offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Mercedes-Benz offers",
    };
  }
}
