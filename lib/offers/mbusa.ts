import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    // Look for patterns like "for 36 months" or "24 mos. to 36 mos."
    const patterns = [
      /for\s+(\d+)\s+months?/i,
      /(\d+)\s+mos?\.?\s+to\s+(\d+)\s+mos?/i, // Take the second number (longer term)
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // If pattern has two numbers (e.g., "24 mos. to 36 mos."), use the second one
        const term = match[2] ? parseInt(match[2], 10) : parseInt(match[1], 10);
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

export async function scrapeOffersFromMBUSA() {
  try {
    const response = await fetch(
      "https://www.mbusa.com/en/special-offers/jcr:content.filter-offer-json.html",
      {
        method: "GET",
        redirect: "follow",
      },
    );

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
          const monthlyPayment = offerSummary.payValue || null;
          const apr = offerSummary.rateValue || null; // APR is a percentage (e.g., 1.99)
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

          // Only create offer if we have at least model and year
          if (model && year) {
            // Create finance offer if APR and rate description are present
            if (apr !== null && rateDescription) {
              const financeTermMonths = extractTermMonths(rateDescription);
              offers.push({
                brand: "Mercedes-Benz",
                year,
                make: "Mercedes-Benz",
                model,
                modelCode,
                trim,
                offerType: "financing",
                offerAmount: null,
                apr: apr / 100, // Convert percentage to decimal (1.99 -> 0.0199)
                termMonths: financeTermMonths,
                cashBack: null,
                dueAtSigning: null,
                monthlyPayment: null,
                milesPerYear: null,
                expirationDate,
                terms: packageName || rateDescription || null,
                finePrint: leaseRateDisclaimerText || null,
                scrapedAt,
              });
            }

            // Create lease offer if monthly payment and pay description are present
            if (monthlyPayment !== null && payDescription) {
              const leaseTermMonths = extractTermMonths(payDescription);
              const dueAtSigning = extractDueAtSigning(payDescription);
              offers.push({
                brand: "Mercedes-Benz",
                year,
                make: "Mercedes-Benz",
                model,
                modelCode,
                trim,
                offerType: "lease",
                offerAmount: null,
                apr: null,
                termMonths: leaseTermMonths,
                cashBack: null,
                dueAtSigning,
                monthlyPayment,
                milesPerYear: null,
                expirationDate,
                terms: packageName || payDescription || null,
                finePrint: leasePaymentDisclaimerText || null,
                scrapedAt,
              });
            }
          }
        }
      }
    }

    console.log("Mercedes-Benz offers found:", offers.length);

    // Delete all existing Mercedes-Benz offers first
    await prisma.offers.deleteMany({
      where: {
        brand: "Mercedes-Benz",
      },
    });
    console.log("Deleted all existing Mercedes-Benz offers");

    // Store offers in database - process in batches to avoid transaction timeout
    if (offers.length > 0) {
      const BATCH_SIZE = 10; // Process 10 offers at a time
      for (let i = 0; i < offers.length; i += BATCH_SIZE) {
        const batch = offers.slice(i, i + BATCH_SIZE);
        try {
          await prisma.$transaction(
            async (tx) => {
              // Create new offers (public data, no dealer ownership) using createMany
              await tx.offers.createMany({
                data: batch.map((offer) => ({
                  brand: offer.brand,
                  year: offer.year,
                  make: offer.make,
                  model: offer.model,
                  modelCode: offer.modelCode,
                  trim: offer.trim,
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
                  expirationDate: offer.expirationDate,
                  scrapedAt: offer.scrapedAt,
                })),
                skipDuplicates: true, // Skip duplicates if any
              });
            },
            {
              maxWait: 10000, // Maximum time to wait for a transaction slot
              timeout: 30000, // Maximum time the transaction can run (30 seconds)
            },
          );
        } catch (err: any) {
          // Log but don't fail on batch errors
          console.error("Error storing Mercedes-Benz offer batch:", err?.message || err);
        }
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Mercedes-Benz offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Mercedes-Benz offers",
    };
  }
}
