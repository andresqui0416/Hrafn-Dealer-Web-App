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

// Extract monthly payment from title (e.g., "$309/month")
function extractMonthlyPayment(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/\$([\d,]+)\/month/i);
    if (match) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract APR from title (e.g., "0% APR", "1.90% APR")
function extractApr(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/([\d.]+)%\s*APR/i);
    if (match) {
      const apr = parseNumber(match[1]);
      return apr !== null ? apr / 100 : null; // Convert percentage to decimal
    }
    return null;
  } catch {
    return null;
  }
}

// Extract cash amount from title (e.g., "Up to $11,000 Customer Cash", "$500")
function extractCashAmount(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    // Try to match "Up to $X" or just "$X"
    const match = text.match(/(?:up\s+to\s+)?\$([\d,]+)/i);
    if (match) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract term months from heading (e.g., "24 Months", "72 Months, Including...")
function extractTermMonths(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/(\d+)\s+months?/i);
    if (match) {
      const term = parseInt(match[1], 10);
      if (!isNaN(term) && term > 0) return term;
    }
    return null;
  } catch {
    return null;
  }
}

// Extract due at signing amount from description (e.g., "$3,999 Due at Signing for Qualified Lessees")
function extractDueAtSigning(description: string[] | null | undefined): number | null {
  if (!description || !Array.isArray(description)) return null;
  try {
    const text = description.join(" ");
    const match = text.match(/\$([\d,]+)\s+due\s+at\s+signing/i);
    if (match) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract bonus cash from heading (e.g., "Including $3,500 APR Bonus Cash")
function extractBonusCash(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/including\s+\$([\d,]+)\s+(?:apr\s+)?bonus\s+cash/i);
    if (match) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Public-facing URL for Kia offers (stored in DB)
const KIA_SOURCE_URL = "https://www.kia.com/us/en/offers/result?seriesId=all&year=2026&zipCode=95556&offers=3%2C2%2C1%2C4";

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

interface KiaOffer {
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

const KIA_BROWSER_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  "Cache-Control": "max-age=0",
  "Sec-Ch-Ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
} as const;

export async function scrapeOffersFromKia(zipCode: string = "95556") {
  try {
    const url = `https://www.kia.com/us/services/en/offers/${zipCode}`;

    // Fetch dropdown data (vehicles + categories) from Kia dropDowns API
    const dropDownsRes = await fetch("https://www.kia.com/us/services/en/offers/dropDowns", {
      method: "GET",
      headers: { ...KIA_BROWSER_HEADERS },
      redirect: "follow",
    });

    if (!dropDownsRes.ok) {
      console.error("Kia dropDowns API error:", dropDownsRes.status);
      throw new Error(`Kia dropDowns request failed: ${dropDownsRes.status}`);
    }

    let dropDowns: any;
    try {
      dropDowns = await dropDownsRes.json();
    } catch {
      throw new Error("Invalid JSON from Kia dropDowns API");
    }

    // categories: from allOffers.result, ordered by orderId (e.g. [3, 2, 1, 4] = Cash, Lease, Finance, Other)
    const categories: number[] =
      Array.isArray(dropDowns?.allOffers?.result) &&
      dropDowns.allOffers.result.length > 0
        ? [...dropDowns.allOffers.result]
            .sort((a: { orderId?: number }, b: { orderId?: number }) => (a.orderId ?? 0) - (b.orderId ?? 0))
            .map((r: { id: number }) => r.id)
        : [3, 2, 1, 4];

    // vehicles: from categories[].vehicles[].seriesId + years[].year (flatten)
    const vehicles: { seriesId: string; year: number }[] =
      Array.isArray(dropDowns?.categories) && dropDowns.categories.length > 0
        ? dropDowns.categories.flatMap((cat: { vehicles?: Array<{ seriesId?: string; years?: Array<{ year?: number }> }> }) =>
            (cat.vehicles || []).flatMap((v: { seriesId?: string; years?: Array<{ year?: number }> }) =>
              (v.years || []).map((y: { year?: number }) => ({
                seriesId: v.seriesId || "",
                year: y.year ?? 0,
              })),
            ),
          ).filter((v: { seriesId: string; year: number }) => v.seriesId && v.year > 0)
        : [];

    if (vehicles.length === 0) {
      console.warn(
        "Kia dropDowns returned no vehicles; response structure may have changed. Check dropDowns API.",
      );
    }

    const requestBody = {
      vehicles,
      categories,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...KIA_BROWSER_HEADERS,
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        Origin: "https://www.kia.com",
        Referer: "https://www.kia.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
      },
      body: JSON.stringify(requestBody),
      redirect: "follow",
    });

    const text = await response.text();

    if (!response.ok) {
      // Check if response is HTML (error page)
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        console.error("Kia API returned HTML error page:", response.status);
        console.error("Response preview:", text.substring(0, 500));
        throw new Error(
          `Kia API request failed: ${response.status} - Server returned HTML error page. The API may require authentication or the endpoint may have changed.`,
        );
      }
      console.error("Kia API error:", response.status, text.substring(0, 500));
      throw new Error(`Kia API request failed: ${response.status}`);
    }

    let data: any;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      // Check if response is HTML instead of JSON
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        console.error(
          "Kia API returned HTML instead of JSON. Response preview:",
          text.substring(0, 500),
        );
        throw new Error(
          "Kia API returned HTML error page instead of JSON. The endpoint may require authentication or may have changed.",
        );
      }
      console.error("Failed to parse Kia API response as JSON:", text.substring(0, 500));
      throw new Error("Invalid JSON response from Kia API");
    }

    if (!data?.result?.vehicle || !Array.isArray(data.result.vehicle)) {
      console.error("Unexpected API response structure:", data);
      return { success: false, error: "Unexpected API response structure" };
    }

    // Helper function to fetch detailed offer data
    async function fetchOfferDetails(
      zipCode: string,
      offerId: number,
      vehicleId: number,
    ): Promise<any | null> {
      try {
        const detailsUrl = `https://www.kia.com/us/services/en/offers/details/${zipCode}/${offerId}/${vehicleId}`;
        const detailsResponse = await fetch(detailsUrl, {
          method: "GET",
          headers: {
            ...KIA_BROWSER_HEADERS,
            Accept: "application/json, text/plain, */*",
            Origin: "https://www.kia.com",
            Referer: "https://www.kia.com/us/en/offers",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
          },
          redirect: "follow",
        });

        if (!detailsResponse.ok) {
          return null;
        }

        const detailsText = await detailsResponse.text();
        const detailsData = JSON.parse(detailsText);
        return detailsData?.result?.vehicle || null;
      } catch (error) {
        // Silently fail on individual detail fetches
        return null;
      }
    }

    // Helper function to extract text from HTML (for disclaimers)
    function extractTextFromHtml(html: string | null | undefined): string {
      if (!html) return "";
      // Simple HTML tag removal
      return html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();
    }

    const offers: KiaOffer[] = [];
    const scrapedAt = new Date();

    // First pass: collect all offers with their IDs
    const offerDetails: Array<{
      offer: any;
      modelName: string;
      seriesId: string | null;
      modelYear: number;
    }> = [];

    for (const vehicle of data.result.vehicle) {
      const modelName = vehicle.series || "";
      const seriesId = vehicle.seriesId || null;
      const years = vehicle.years || [];

      for (const yearData of years) {
        const modelYear = yearData.year;
        const offersList = yearData.offers || [];

        for (const offer of offersList) {
          offerDetails.push({
            offer,
            modelName,
            seriesId,
            modelYear,
          });
        }
      }
    }

    console.log(`Found ${offerDetails.length} Kia offers, fetching details...`);

    // Second pass: fetch detailed data for each offer
    for (const { offer, modelName, seriesId, modelYear } of offerDetails) {
      let detailedData: any = null;

      // Fetch detailed data if we have offerId and vehicleId
      if (offer.offerId && offer.vehicleId) {
        detailedData = await fetchOfferDetails(zipCode, offer.offerId, offer.vehicleId);

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const categoryName = offer.catergoryName || offer.categoryName || "";
      const title = offer.title || "";
      const heading = offer.heading || "";
      const description = offer.description || [];
      const descriptionText = Array.isArray(description) ? description.join(" ") : "";

      // Use detailed data if available, otherwise use basic offer data
      const finalTitle = detailedData?.details?.title || title;
      const finalHeading = detailedData?.details?.heading || heading;
      const finalDescription = detailedData?.details?.description || description;
      const finalDescriptionText = Array.isArray(finalDescription)
        ? finalDescription.join(" ")
        : finalDescription || descriptionText;
      const finalTrimName = detailedData?.trimName || offer.trimName || null;

      // Collect disclaimers from detailed data
      let finePrint: string | null = null;
      if (detailedData?.disclaimers && Array.isArray(detailedData.disclaimers)) {
        const disclaimerTexts = detailedData.disclaimers
          .map((d: any) => {
            const desc = d.description || "";
            const disc = extractTextFromHtml(d.disclaimer || "");
            return disc || desc;
          })
          .filter((text: string) => text.trim().length > 0);
        finePrint = disclaimerTexts.join(" ").trim() || null;
      }

      // Determine offer type based on category
      let offerType: "lease" | "financing" | "cash" = "cash";
      if (categoryName === "Lease") {
        offerType = "lease";
      } else if (categoryName === "Finance") {
        offerType = "financing";
      } else if (categoryName === "Cash") {
        offerType = "cash";
      }

      // Extract offer-specific data
      let leaseMonthlyPayment: number | null = null;
      let aprRate: number | null = null;
      let cashValue: number | null = null;
      let offerAmount: number | null = null;
      let leaseTermMonths: number | null = null;
      let aprTermMonths: number | null = null;
      let leaseDueAtSigning: number | null = null;
      let bonusCash: number | null = null;

      if (offerType === "lease") {
        leaseMonthlyPayment = extractMonthlyPayment(finalTitle);
        leaseTermMonths = extractTermMonths(finalHeading);
        leaseDueAtSigning = extractDueAtSigning(finalDescription);
        bonusCash = extractBonusCash(finalHeading);
        cashValue = bonusCash;
        // Don't set offerAmount from leaseMonthlyPayment - keep them separate
        offerAmount = null;
      } else if (offerType === "financing") {
        aprRate = extractApr(finalTitle);
        aprTermMonths = extractTermMonths(finalHeading);
        bonusCash = extractBonusCash(finalHeading);
        cashValue = bonusCash;
        offerAmount = null;
      } else if (offerType === "cash") {
        cashValue = extractCashAmount(finalTitle);
        // Don't set offerAmount from cashValue - keep them separate
        offerAmount = null;
        // Also check includedCashOffers for total amount
        if (offer.includedCashOffers && Array.isArray(offer.includedCashOffers)) {
          // Try to extract total from included offers
          const totalMatch = finalTitle.match(/(?:up\s+to\s+)?\$([\d,]+)/i);
          if (totalMatch) {
            cashValue = parseNumber(totalMatch[1]);
          }
        }
      }

      // Build terms string
      const termsParts: string[] = [];
      if (finalTitle) termsParts.push(finalTitle);
      if (finalHeading) termsParts.push(finalHeading);
      if (finalDescriptionText) termsParts.push(finalDescriptionText);
      const terms = termsParts.join(" ").trim() || null;

      // Bonus/discount: extract from terms + finePrint (API has no structured fields)
      const combinedText = [terms || "", finePrint || ""].filter(Boolean).join("\n");
      const loyaltyBonus = extractAmountNearKeyword(combinedText, /loyalty\s*(?:bonus|cash|rebate)?/i);
      const conquestBonus = extractAmountNearKeyword(combinedText, /conquest\s*(?:bonus|cash|rebate)?/i);
      const militaryDiscount = extractAmountNearKeyword(combinedText, /military\s*(?:discount|bonus|rebate)?/i);
      const collegeGrad = extractAmountNearKeyword(combinedText, /college\s*(?:grad|graduate|rebate|bonus)?/i);
      const firstResponder = extractAmountNearKeyword(combinedText, /first\s*responder\s*(?:discount|bonus|rebate)?/i);

      offers.push({
        brand: "Kia",
        year: modelYear,
        make: "Kia",
        model: modelName,
        modelCode: seriesId,
        trim: finalTrimName,
        offerType,
        offerAmount,
        aprRate,
        aprTermMonths,
        leaseTermMonths,
        cashValue,
        tradeDiscount: null,
        leaseDueAtSigning,
        leaseMonthlyPayment,
        milesPerYear: null,
        terms,
        finePrint,
        expirationDate: parseDate(offer.endDate),
        scrapedAt,
        sourceUrl: KIA_SOURCE_URL,
        loyaltyBonus: loyaltyBonus ?? null,
        conquestBonus: conquestBonus ?? null,
        militaryDiscount: militaryDiscount ?? null,
        collegeGrad: collegeGrad ?? null,
        firstResponder: firstResponder ?? null,
      });
    }

    console.log("Kia incentives found:", offers.length);

    const result = await storeScrapedIncentives({
      brand: "Kia",
      offers: offers as NormalizedIncentiveOffer[],
      source: "kia",
    });
    if (!result.success) {
      return { success: false, totalOffers: 0, error: result.error };
    }
    return { success: true, totalOffers: result.stored };
  } catch (error: any) {
    console.error("Error scraping Kia offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Kia offers",
    };
  }
}
