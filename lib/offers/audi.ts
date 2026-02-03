import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Public-facing URL for Audi offers (stored in DB)
const AUDI_SOURCE_URL = "https://www.audiusa.com/en/offers/";

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

// Extract miles per year from lease offer disclaimer (e.g., "in excess of 30,000 miles")
function extractMilesPerYearFromDisclaimer(
  disclaimer: string | null | undefined,
  termMonths: number | null | undefined,
): number | null {
  if (!disclaimer || !termMonths || termMonths <= 0) return null;
  try {
    const match = disclaimer.match(/in excess of\s+([\d,]+)\s+miles/i);
    if (match && match[1]) {
      const totalMiles = parseNumber(match[1]);
      if (totalMiles && totalMiles > 0) {
        const years = termMonths / 12;
        if (years > 0) {
          const milesPerYear = totalMiles / years;
          return Math.round(milesPerYear);
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function scrapeOffersFromAudi() {
  try {
    const headers = new Headers();
    headers.append("apollographql-client-name", "fa-vlp-list-page");
    headers.append("apollographql-client-version", "5.17.4");
    headers.append("Content-Type", "application/json");

    const body = JSON.stringify({
      operationName: "UsCustomerOffers",
      variables: {
        zipCode: "95556",
      },
      query:
        "query UsCustomerOffers($zipCode: String, $offerMonth: String) {\n  usCustomerOffers(zipCode: $zipCode, offerMonth: $offerMonth) {\n    zipClusterID\n    offerModelDetail {\n      modelCode\n      modelYear\n      bodyType\n      trimline\n      productModelCode\n      modelCodeDescription\n      msrp\n      modelFamily\n      __typename\n    }\n    stackableOffers {\n      offerType\n      creditBonus\n      programShortDescription\n      offerDisclaimer\n      programName\n      __typename\n    }\n    offerDisclaimer\n    offerImageUrl\n    featuredOfferImageUrl\n    programName\n    offerType\n    programPriority\n    programFromDate\n    programToDate\n    programShortDescription\n    region\n    zipClusterID\n    aprRate\n    creditBonus\n    term\n    totalDueAtSign\n    customerDownPayment\n    monthlyPayment\n    __typename\n  }\n}",
    });

    const audiApiUrl = "https://api.audiusa.com/graphql";
    const response = await fetch(audiApiUrl, {
      method: "POST",
      headers,
      body,
      redirect: "follow",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Audi API error:", response.status, text);
      throw new Error(`Audi API request failed: ${response.status}`);
    }
    const data = await response.json();

    if (!data?.data?.usCustomerOffers || !Array.isArray(data.data.usCustomerOffers)) {
      console.error("Unexpected API response structure:", JSON.stringify(data, null, 2));
      return { success: false, error: "Unexpected API response structure" };
    }

    const offers: any[] = [];
    const scrapedAt = new Date();

    // Extract offer data from each offer
    for (const offer of data.data.usCustomerOffers) {
      const modelDetail = offer.offerModelDetail || {};

      // Parse dates from format "20251202" (YYYYMMDD)
      let expirationDate: Date | null = null;
      if (offer.programToDate) {
        try {
          const year = parseInt(offer.programToDate.substring(0, 4));
          const month = parseInt(offer.programToDate.substring(4, 6)) - 1; // Month is 0-indexed
          const day = parseInt(offer.programToDate.substring(6, 8));
          expirationDate = new Date(year, month, day);
          if (isNaN(expirationDate.getTime())) {
            expirationDate = null;
          }
        } catch {
          expirationDate = null;
        }
      }

      // Map offerType from API to our schema
      let offerType: "cash" | "financing" | "lease" = "cash";
      if (offer.offerType === "lease") {
        offerType = "lease";
      } else if (offer.offerType === "finance") {
        offerType = "financing";
      } else if (offer.offerType === "credit") {
        offerType = "cash"; // Credit bonuses are cash offers
      }

      // Don't populate offerAmount from creditBonus or monthlyPayment - keep them separate
      // offerAmount should only be set if explicitly extracted from the offer content
      let offerAmount: number | null = null;

      // APR / term fields
      const aprTermMonths =
        offer.offerType === "finance" && offer.term && offer.term > 0 ? offer.term : null;
      const leaseTermMonths =
        offer.offerType === "lease" && offer.term && offer.term > 0 ? offer.term : null;

      // Bonus/discount: extract from programShortDescription + offerDisclaimer (API has no structured fields)
      const termsText = offer.programShortDescription || "";
      const finePrintText = offer.offerDisclaimer || "";
      const combinedText = [termsText, finePrintText].filter(Boolean).join("\n");
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

      // Miles per year from lease disclaimer (only for lease offers)
      const milesPerYear =
        offer.offerType === "lease"
          ? extractMilesPerYearFromDisclaimer(offer.offerDisclaimer, leaseTermMonths)
          : null;

      // Create offer record
      offers.push({
        brand: "Audi",
        year: modelDetail.modelYear || null,
        make: "Audi",
        model: modelDetail.modelFamily || null,
        modelCode: modelDetail.modelCode || null,
        trim: modelDetail.trimline || null,
        offerType,
        offerAmount,
        aprRate: offer.aprRate && offer.aprRate > 0 ? offer.aprRate : null,
        aprTermMonths,
        leaseTermMonths,
        cashValue: offer.creditBonus && offer.creditBonus > 0 ? offer.creditBonus : null,
        leaseDueAtSigning:
          offer.totalDueAtSign && offer.totalDueAtSign > 0 ? offer.totalDueAtSign : null,
        leaseMonthlyPayment:
          offer.monthlyPayment && offer.monthlyPayment > 0 ? offer.monthlyPayment : null,
        milesPerYear,
        expirationDate,
        terms: offer.programShortDescription || null,
        finePrint: offer.offerDisclaimer || null,
        scrapedAt,
        sourceUrl: AUDI_SOURCE_URL,
        loyaltyBonus: loyaltyBonus ?? null,
        conquestBonus: conquestBonus ?? null,
        militaryDiscount: militaryDiscount ?? null,
        collegeGrad: collegeGrad ?? null,
        firstResponder: firstResponder ?? null,
      });

      // Also process stackable offers (additional offers that can be combined)
      // if (offer.stackableOffers && Array.isArray(offer.stackableOffers)) {
      //   for (const stackableOffer of offer.stackableOffers) {
      //     if (stackableOffer.creditBonus && stackableOffer.creditBonus > 0) {
      //       offers.push({
      //         brand: "Audi",
      //         year: modelDetail.modelYear || null,
      //         make: "Audi",
      //         model: modelDetail.modelFamily || null,
      //         modelCode: modelDetail.modelCode || null,
      //         trim: modelDetail.trimline || null,
      //         offerType: "cash", // Stackable offers are typically credit bonuses
      //         offerAmount: stackableOffer.creditBonus,
      //         cashBack: stackableOffer.creditBonus,
      //         expirationDate, // Use same expiration as main offer
      //         terms: stackableOffer.programShortDescription || null,
      //         finePrint: stackableOffer.offerDisclaimer || null,
      //         scrapedAt,
      //       });
      //     }
      //   }
      // }
    }

    console.log("Audi Offers found:", offers.length);

    // Delete all existing offers for this brand first
    const brand = offers.length > 0 ? offers[0].brand : "Audi";
    await prisma.offers.deleteMany({
      where: {
        brand: brand,
      },
    });
    console.log(`Deleted all existing ${brand} offers`);

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
                  aprRate: offer.aprRate,
                  aprTermMonths: offer.aprTermMonths,
                  leaseTermMonths: offer.leaseTermMonths,
                  cashValue: offer.cashValue,
                  leaseDueAtSigning: offer.leaseDueAtSigning,
                  leaseMonthlyPayment: offer.leaseMonthlyPayment,
                  milesPerYear: offer.milesPerYear || null,
                  terms: offer.terms,
                  finePrint: offer.finePrint,
                  expirationDate: offer.expirationDate,
                  scrapedAt: offer.scrapedAt,
                  sourceUrl: offer.sourceUrl ?? null,
                  loyaltyBonus: offer.loyaltyBonus ?? null,
                  conquestBonus: offer.conquestBonus ?? null,
                  militaryDiscount: offer.militaryDiscount ?? null,
                  collegeGrad: offer.collegeGrad ?? null,
                  firstResponder: offer.firstResponder ?? null,
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
          console.error("Error storing Audi offer batch:", err?.message || err);
        }
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Audi offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Audi offers",
    };
  }
}
