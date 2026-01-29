import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Parse number from string, removing commas, dollar signs, and other formatting
function parseNumber(str: string | number | null | undefined): number | null {
  if (str === null || str === undefined) return null;
  if (typeof str === "number") return isNaN(str) ? null : str;
  try {
    const strValue = String(str);
    const cleaned = strValue.replace(/[,$%]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

// Extract cash back amount from text (e.g., "$2,500 Customer Bonus", "$7,500 Customer Bonus")
function extractCashBack(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    // Look for patterns like "$X,XXX Customer Bonus", "$X,XXX Bonus", "$X,XXX Conquest Bonus"
    const patterns = [
      /\$([\d,]+)\s+(?:Customer|Conquest|College\s+Graduate|Military|Veterans)\s+Bonus/i,
      /\$([\d,]+)\s+Bonus/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseNumber(match[1]);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function scrapeOffersFromVW() {
  try {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");

    const body = JSON.stringify({
      query: `
  query productOfferQuery($zipCode: String!) {
    offers: getSpecialOffersByZipCode(zipCode: $zipCode) {
      __typename
      dealAdditionalTerms
      dealCarModel
      dealCarModelName
      dealCarTrim
      dealCarYear
      dealCopy
      dealEndDate
      dealExclusions
      dealId
      dealLegal
      dealLocaleType
      dealOfferTypes
      dealPricePerMonth
      dealPriority
      dealSubtitle
      dealTitle
      dealCustomImageName
      dealDaaCode
      dealDaaName
      dealLocaleTypeOrder
      dealRate
      dealRegionCode
      dealRegionName
      dealStartDate
      dealTerm
      dealerCode
      dealerName
      stateCode
      stateName
      dealCustomImageLocation
    }
  }
`,
      variables: {
        zipCode: "95556",
      },
    });

    const vwApiUrl = "https://api.vw.com/graphql";
    const response = await fetch(vwApiUrl, {
      method: "POST",
      headers,
      body,
      redirect: "follow" as RequestRedirect,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("VW API error:", response.status, text.substring(0, 500));
      throw new Error(`VW API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data?.data?.offers || !Array.isArray(data.data.offers)) {
      console.error(
        "Unexpected API response structure:",
        JSON.stringify(data, null, 2).substring(0, 1000),
      );
      return { success: false, error: "Unexpected API response structure" };
    }

    const offers: any[] = [];
    const scrapedAt = new Date();

    // Process each offer
    for (const offer of data.data.offers) {
      // Skip PRE_LOVED offers
      if (Array.isArray(offer.dealOfferTypes) && offer.dealOfferTypes.includes("PRE_LOVED")) {
        continue;
      }

      // Extract model information from arrays (take first element)
      const modelCode =
        Array.isArray(offer.dealCarModel) && offer.dealCarModel.length > 0
          ? offer.dealCarModel[0]
          : null;
      const modelName =
        Array.isArray(offer.dealCarModelName) && offer.dealCarModelName.length > 0
          ? offer.dealCarModelName[0]
          : null;
      const year =
        Array.isArray(offer.dealCarYear) && offer.dealCarYear.length > 0
          ? parseInt(String(offer.dealCarYear[0]), 10)
          : null;
      const trim =
        Array.isArray(offer.dealCarTrim) && offer.dealCarTrim.length > 0
          ? offer.dealCarTrim[0] === "all"
            ? null
            : offer.dealCarTrim[0]
          : null;

      // Determine offer type from dealOfferTypes array
      let offerType = "cash";
      if (Array.isArray(offer.dealOfferTypes)) {
        if (offer.dealOfferTypes.includes("LEASE")) {
          offerType = "lease";
        } else if (offer.dealOfferTypes.includes("APR")) {
          offerType = "financing";
        } else if (offer.dealOfferTypes.includes("OTHER")) {
          offerType = "cash";
        }
      }

      // Extract offer details based on type
      let aprRate: number | null = null;
      let aprTermMonths: number | null = null;
      let leaseTermMonths: number | null = null;
      let leaseMonthlyPayment: number | null = null;
      let cashValue: number | null = null;

      if (offerType === "financing") {
        // For financing offers, use dealRate and dealTerm
        if (offer.dealRate !== null && offer.dealRate !== undefined) {
          aprRate = parseNumber(offer.dealRate) ? parseNumber(offer.dealRate)! / 100 : null;
        }
        if (offer.dealTerm !== null && offer.dealTerm !== undefined) {
          aprTermMonths = parseInt(String(offer.dealTerm), 10);
          if (isNaN(aprTermMonths)) aprTermMonths = null;
        }
        // Also check for cash back in title/legal text
        cashValue = extractCashBack(offer.dealTitle || offer.dealLegal || "");
      } else if (offerType === "lease") {
        // For lease offers, use dealPricePerMonth
        leaseMonthlyPayment =
          offer.dealPricePerMonth !== null && offer.dealPricePerMonth !== undefined
            ? parseNumber(offer.dealPricePerMonth)
            : null;
        // Extract term from dealTerm, or from dealSubtitle/dealLegal if dealTerm is null
        if (offer.dealTerm !== null && offer.dealTerm !== undefined) {
          leaseTermMonths = parseInt(String(offer.dealTerm), 10);
          if (isNaN(leaseTermMonths)) leaseTermMonths = null;
        }
        // If dealTerm is null, extract from dealSubtitle or dealLegal (e.g., "36-mos", "36 mos", "36 months")
        if (leaseTermMonths === null) {
          const termMatch = (offer.dealSubtitle || offer.dealLegal || "").match(/(\d+)[-\s]*mos?/i);
          if (termMatch && termMatch[1]) {
            leaseTermMonths = parseInt(termMatch[1], 10);
            if (isNaN(leaseTermMonths)) leaseTermMonths = null;
          }
        }
      } else if (offerType === "cash") {
        // For cash offers, extract cash back from title or legal text
        cashValue = extractCashBack(offer.dealTitle || offer.dealLegal || "");
      }

      // Parse expiration date
      let expirationDate: Date | null = null;
      if (offer.dealEndDate) {
        expirationDate = new Date(offer.dealEndDate);
        if (isNaN(expirationDate.getTime())) {
          expirationDate = null;
        }
      }

      // Build terms from title and subtitle
      const termsParts: string[] = [];
      if (offer.dealTitle) termsParts.push(offer.dealTitle);
      if (offer.dealSubtitle) termsParts.push(offer.dealSubtitle);
      const terms = termsParts.length > 0 ? termsParts.join("\n") : null;

      // Fine print from dealLegal
      const finePrint = offer.dealLegal || null;

      // Only create offer if we have meaningful data
      const hasValidData =
        (offerType === "lease" && leaseMonthlyPayment !== null) ||
        (offerType === "financing" && aprRate !== null) ||
        (offerType === "cash" && (cashValue !== null || terms !== null));

      if (!hasValidData) {
        console.warn(`Skipping ${offerType} offer for ${modelName} ${year} - insufficient data`);
        continue;
      }

      offers.push({
        brand: "Volkswagen",
        year: year,
        make: "Volkswagen",
        model: modelName,
        modelCode: modelCode,
        trim: trim,
        offerType: offerType,
        offerAmount: null,
        aprRate: aprRate,
        aprTermMonths: offerType === "financing" ? aprTermMonths : null,
        leaseTermMonths: offerType === "lease" ? leaseTermMonths : null,
        cashValue: cashValue,
        tradeDiscount: null,
        leaseDueAtSigning: null, // Could extract from dealLegal if needed
        leaseMonthlyPayment: leaseMonthlyPayment,
        milesPerYear: null,
        expirationDate: expirationDate,
        terms: terms,
        finePrint: finePrint,
        scrapedAt: scrapedAt,
        sourceUrl: vwApiUrl,
      });
    }

    console.log("Volkswagen offers found:", offers.length);

    // Delete all existing Volkswagen offers first
    await prisma.offers.deleteMany({
      where: {
        brand: "Volkswagen",
      },
    });
    console.log("Deleted all existing Volkswagen offers");

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
                  tradeDiscount: offer.tradeDiscount,
                  leaseDueAtSigning: offer.leaseDueAtSigning,
                  leaseMonthlyPayment: offer.leaseMonthlyPayment,
                  milesPerYear: offer.milesPerYear,
                  terms: offer.terms,
                  finePrint: offer.finePrint,
                  expirationDate: offer.expirationDate,
                  scrapedAt: offer.scrapedAt,
                  sourceUrl: offer.sourceUrl ?? null,
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
          console.error("Error storing Volkswagen offer batch:", err?.message || err);
        }
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Volkswagen offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Volkswagen offers",
    };
  }
}
