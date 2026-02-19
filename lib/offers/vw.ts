import { storeScrapedIncentives, type NormalizedIncentiveOffer } from "@/lib/incentives/storeScrapedIncentives";

// Public-facing URL for Volkswagen offers (stored in DB)
const VW_SOURCE_URL = "https://www.vw.com/en/offers.html";

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

// Extract due at signing from text (e.g., "$3,499 due at signing")
function extractDueAtSigning(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/\$([\d,]+)\s+due\s+at\s+signing/i);
    if (match && match[1]) return parseNumber(match[1]);
    return null;
  } catch {
    return null;
  }
}

// Extract miles per year from lease text (dealLegal/dealSubtitle).
// Looks for explicit "X miles per year" or derives from total miles (e.g. "over 30,000 miles" with 36-month lease -> 10,000 mi/year).
function extractMilesPerYear(
  text: string | null | undefined,
  leaseTermMonths: number | null,
): number | null {
  if (!text) return null;
  try {
    const plain = text.replace(/<[^>]+>/g, " ");
    // Explicit miles per year
    const perYearMatch = plain.match(
      /(\d{1,3}(?:,\d{3})*|\d+)\s*miles?\s+per\s+year|(\d{1,3}(?:,\d{3})*|\d+)\s*mi\s*\/\s*year|(\d{1,3}(?:,\d{3})*|\d+)\s*mi\s*\/\s*yr/i,
    );
    if (perYearMatch) {
      const num = parseNumber(perYearMatch[1] || perYearMatch[2] || perYearMatch[3]);
      if (num !== null && num > 0) return num;
    }
    // Total miles: "over 30,000 miles", "30,000 miles and excessive"
    const totalMatch = plain.match(
      /(?:over|per)\s+(\d{1,3}(?:,\d{3})*|\d+)\s*miles|(\d{1,3}(?:,\d{3})*|\d+)\s*miles,?\s+(?:and\s+(?:excessive|vehicle))/i,
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

// Extract cash back amount from text (e.g., "$2,500 Customer Bonus", "$7,500 Customer Bonus")
function extractCashBack(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    // Look for patterns like "$X,XXX Customer Bonus", "$500 Military, Veterans & First Responders Bonus", "$X,XXX Bonus"
    const patterns = [
      /\$([\d,]+)\s+(?:Customer|Conquest|College\s+Graduate|Military|Veterans)\s+Bonus/i,
      /\$([\d,]+)\s+Military,?\s*Veterans\s*&(?:amp;)?\s*First\s+Responders?\s+Bonus/i,
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

// Extract dollar amount near a keyword for schema bonus/discount fields.
// Wraps keyword in (?: ) so alternation (|) inside the keyword doesn't break the regex.
function extractAmountNearKeyword(
  text: string | null | undefined,
  keyword: RegExp,
): number | null {
  if (!text) return null;
  try {
    const kw = `(?:${keyword.source})`;
    const afterKeyword = new RegExp(`${kw}[\\s\\S]{0,80}?\\$([\\d,]+)`, "i");
    let match = text.match(afterKeyword);
    if (match && match[1]) return parseNumber(match[1]);
    const beforeKeyword = new RegExp(`\\$([\\d,]+)[\\s\\S]{0,80}?${kw}`, "i");
    match = text.match(beforeKeyword);
    if (match && match[1]) return parseNumber(match[1]);
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
      let offerType: "cash" | "financing" | "lease" = "cash";
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
      let leaseDueAtSigning: number | null = null;
      let milesPerYear: number | null = null;
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
        // Extract term from dealTerm, or from dealTitle/dealSubtitle/dealLegal (e.g., "36-month lease", "36 mos", "36 months")
        if (offer.dealTerm !== null && offer.dealTerm !== undefined) {
          leaseTermMonths = parseInt(String(offer.dealTerm), 10);
          if (isNaN(leaseTermMonths)) leaseTermMonths = null;
        }
        if (leaseTermMonths === null) {
          const leaseText = [offer.dealTitle, offer.dealSubtitle, offer.dealLegal]
            .filter(Boolean)
            .join(" ");
          const termMatch = leaseText.match(/(\d+)[-\s]*(?:mos?|months?)/i);
          if (termMatch && termMatch[1]) {
            leaseTermMonths = parseInt(termMatch[1], 10);
            if (isNaN(leaseTermMonths)) leaseTermMonths = null;
          }
        }
        // Extract due at signing from dealTitle, dealSubtitle, or dealLegal (e.g., "$3,499 due at signing")
        leaseDueAtSigning = extractDueAtSigning(
          offer.dealTitle + offer.dealSubtitle + offer.dealLegal || "",
        );
        // Extract miles per year from dealLegal/dealSubtitle (e.g. "over 30,000 miles" with 36-month lease -> 10,000 mi/year)
        const leaseText = [offer.dealTitle, offer.dealSubtitle, offer.dealLegal]
          .filter(Boolean)
          .join(" ");
        milesPerYear = extractMilesPerYear(leaseText, leaseTermMonths);
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

      // Extract bonus/discount amounts from title, subtitle, and legal text
      const combinedText = [offer.dealTitle, offer.dealSubtitle, offer.dealLegal]
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
      // VW dealLegal: "$500 Military and First Responders Bonus" → military discount
      const militaryDiscount = extractAmountNearKeyword(
        combinedText,
        /military\s+(?:and\s+first\s+responders?)?\s*bonus|military\s*(?:discount|bonus|rebate)?/i,
      );
      // VW dealTitle/dealLegal: "$1,000 College Graduate Bonus" or "$500 College Graduate Bonus" → college grad value
      let collegeGrad = (() => {
        const directMatch = combinedText.match(/\$([\d,]+)\s+College\s+Graduate\s+Bonus/i);
        if (directMatch && directMatch[1]) return parseNumber(directMatch[1]);
        return extractAmountNearKeyword(
          combinedText,
          /college\s+graduate\s+bonus|college\s+grad(?:uate)?/i,
        );
      })();
      // VW dealLegal: same "$500 Military and First Responders Bonus" can set firstResponder
      const firstResponder = extractAmountNearKeyword(
        combinedText,
        /first\s+responders?\s+bonus|first\s*responder\s*(?:discount|bonus|rebate)?/i,
      );

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
        leaseDueAtSigning,
        leaseMonthlyPayment: leaseMonthlyPayment,
        milesPerYear,
        expirationDate: expirationDate,
        terms: terms,
        finePrint: finePrint,
        scrapedAt: scrapedAt,
        sourceUrl: VW_SOURCE_URL,
        loyaltyBonus: loyaltyBonus ?? null,
        conquestBonus: conquestBonus ?? null,
        militaryDiscount: militaryDiscount ?? null,
        collegeGrad: collegeGrad ?? null,
        firstResponder: firstResponder ?? null,
      });
    }

    console.log("Volkswagen incentives found:", offers.length);

    const result = await storeScrapedIncentives({
      brand: "Volkswagen",
      offers: offers as NormalizedIncentiveOffer[],
      source: "vw",
    });
    if (!result.success) {
      return { success: false, totalOffers: 0, error: result.error };
    }
    return { success: true, totalOffers: result.stored };
  } catch (error: any) {
    console.error("Error scraping Volkswagen offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Volkswagen offers",
    };
  }
}
