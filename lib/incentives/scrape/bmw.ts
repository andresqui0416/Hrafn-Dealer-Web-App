import {
  createScrapeEvent,
  markScrapeEventFailed,
  storeScrapedIncentives,
  type NormalizedIncentiveOffer,
} from "@/lib/incentives/storeScrapedIncentives";

// Public-facing URL for BMW offers (stored in DB)
const BMW_SOURCE_URL = "https://www.bmwusa.com/special-offers-new.html#/";

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

// Extract dollar amount near a keyword from disclaimer/description text (for bonus fields)
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

export async function scrapeOffersFromBMW() {
  const { scrapeEventId } = await createScrapeEvent({
    brand: "BMW",
    source: "bmw",
  });
  try {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const bmwApiUrl =
        "https://www.bmwusa.com/offers-api/current-offers/v2?bySeries=true";
      const response = await fetch(bmwApiUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
          priority: "u=1, i",
          referer: "https://www.bmwusa.com/special-offers-new.html",
          "sec-ch-ua":
            '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        console.error("BMW API error:", response.status, text.substring(0, 500));
        throw new Error(`BMW API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data || typeof data !== "object") {
        console.error(
          "Unexpected API response structure:",
          JSON.stringify(data, null, 2).substring(0, 1000),
        );
        return { success: false, error: "Unexpected API response structure" };
      }

      const offers: any[] = [];
      const scrapedAt = new Date();

      // The response structure: object where keys are series names and values are objects containing vehicles
      // Each vehicle is also an object with lease_offer and finance_offer

      // Process each series (key in the data.vehicles object)
      if (!data.vehicles || typeof data.vehicles !== "object") {
        console.warn("No vehicles found in BMW API response");
        return { success: false, error: "No vehicles found in API response" };
      }

      for (const seriesName in data.vehicles) {
        if (!data.vehicles.hasOwnProperty(seriesName)) continue;

        const models = data.vehicles[seriesName];
        if (!models || typeof models !== "object" || Array.isArray(models)) continue;

        // Process each vehicle in the models object
        for (const modelKey in models) {
          if (!models.hasOwnProperty(modelKey)) continue;
          const modelData = models[modelKey];
          if (!modelData || typeof modelData !== "object") continue;

          // Extract model information
          const modelName = modelData.name;
          const modelCode = modelData.code;
          const year = modelData.model_year;
          const trim = modelData.trim || null;

          // Process lease_offer if it exists
          if (modelData.lease_offer && typeof modelData.lease_offer === "object") {
            const leaseOffer = modelData.lease_offer;

            const leaseMonthlyPayment = leaseOffer.monthly_payment
              ? parseNumber(leaseOffer.monthly_payment)
              : null;

            const leaseTermMonths = leaseOffer.lease_term
              ? parseInt(String(leaseOffer.lease_term), 10)
              : null;

            const leaseDueAtSigning = leaseOffer.due_at_signing_except_ny
              ? parseNumber(leaseOffer.due_at_signing_except_ny)
              : null;

            const milesPerYear = leaseOffer.miles_per_year
              ? parseInt(String(leaseOffer.miles_per_year), 10)
              : null;

            // Extract expiration date - prioritize end_date
            let expirationDate: Date | null = null;
            if (leaseOffer.end_date) {
              expirationDate = new Date(leaseOffer.end_date);
            }

            // Validate expiration date
            if (expirationDate && isNaN(expirationDate.getTime())) {
              expirationDate = null;
            }

            // Extract terms and fine print
            const terms = leaseOffer.description || null;
            const finePrint =
              leaseOffer.additional_disclaimer || leaseOffer.offer_disclaimer || null;

            // Bonus/discount fields: loyalty_credit from API, others from disclaimer text
            const combinedText = [terms, finePrint].filter(Boolean).join(" ");
            const loyaltyBonus =
              leaseOffer.loyalty_credit != null
                ? parseNumber(leaseOffer.loyalty_credit)
                : extractAmountNearKeyword(
                    combinedText,
                    /loyalty\s*(?:bonus|cash|credit|rebate)?/i,
                  );
            const conquestBonus = extractAmountNearKeyword(
              combinedText,
              /conquest\s*(?:bonus|cash|rebate)?/i,
            );
            const militaryDiscount = extractAmountNearKeyword(
              combinedText,
              /military\s+(?:and\s+first\s+responders?)?\s*bonus|military\s*(?:discount|bonus|rebate)?/i,
            );
            let collegeGrad: number | null = (() => {
              const directMatch = combinedText.match(
                /\$([\d,]+)\s+College\s+Graduate\s+Bonus/i,
              );
              if (directMatch && directMatch[1]) return parseNumber(directMatch[1]);
              return extractAmountNearKeyword(
                combinedText,
                /college\s+graduate\s+bonus|college\s+grad(?:uate)?/i,
              );
            })();
            const firstResponder = extractAmountNearKeyword(
              combinedText,
              /first\s+responders?\s+bonus|first\s*responder\s*(?:discount|bonus|rebate)?/i,
            );

            // Only create offer if we have meaningful data
            if (leaseMonthlyPayment !== null) {
              offers.push({
                brand: "BMW",
                year: year ? parseInt(String(year), 10) : null,
                make: "BMW",
                model: modelName,
                modelCode: modelCode,
                trim: trim,
                offerType: "lease",
                offerAmount: null,
                aprRate: null,
                aprTermMonths: null,
                leaseTermMonths: leaseTermMonths,
                cashValue: null,
                tradeDiscount: null,
                leaseDueAtSigning: leaseDueAtSigning,
                leaseMonthlyPayment: leaseMonthlyPayment,
                milesPerYear: milesPerYear,
                expirationDate: expirationDate,
                terms: terms,
                finePrint: finePrint,
                loyaltyBonus: loyaltyBonus ?? null,
                conquestBonus: conquestBonus ?? null,
                militaryDiscount: militaryDiscount ?? null,
                collegeGrad: collegeGrad ?? null,
                firstResponder: firstResponder ?? null,
                scrapedAt: scrapedAt,
                sourceUrl: BMW_SOURCE_URL,
              });
            }
          }

          // Process finance_offer if it exists
          if (modelData.finance_offer && typeof modelData.finance_offer === "object") {
            const financeOffer = modelData.finance_offer;

            const aprValue = financeOffer.apr_2
              ? parseNumber(financeOffer.apr_2)
              : financeOffer.apr_1
                ? parseNumber(financeOffer.apr_1)
                : null;
            const aprRate = aprValue !== null ? aprValue / 100 : null;

            const aprTermMonths = financeOffer.months_2
              ? parseInt(String(financeOffer.months_2), 10)
              : financeOffer.months_1
                ? parseInt(String(financeOffer.months_1), 10)
                : null;

            // Extract expiration date - prioritize end_date
            let expirationDate: Date | null = null;
            if (financeOffer.end_date) {
              expirationDate = new Date(financeOffer.end_date);
            }

            // Validate expiration date
            if (expirationDate && isNaN(expirationDate.getTime())) {
              expirationDate = null;
            }

            // Extract terms and fine print
            const terms =
              financeOffer.description ||
              financeOffer.terms ||
              financeOffer.short_description ||
              financeOffer.program_short_description ||
              null;
            const finePrint =
              financeOffer.fine_print ||
              financeOffer.disclaimer ||
              financeOffer.additional_disclaimer ||
              financeOffer.offer_disclaimer ||
              null;

            // Bonus/discount fields: loyalty_credit from API if present, others from disclaimer text
            const combinedText = [terms, finePrint].filter(Boolean).join(" ");
            const loyaltyBonus =
              (financeOffer as { loyalty_credit?: string }).loyalty_credit != null
                ? parseNumber((financeOffer as { loyalty_credit?: string }).loyalty_credit)
                : extractAmountNearKeyword(
                    combinedText,
                    /loyalty\s*(?:bonus|cash|credit|rebate)?/i,
                  );
            const conquestBonus = extractAmountNearKeyword(
              combinedText,
              /conquest\s*(?:bonus|cash|rebate)?/i,
            );
            const militaryDiscount = extractAmountNearKeyword(
              combinedText,
              /military\s+(?:and\s+first\s+responders?)?\s*bonus|military\s*(?:discount|bonus|rebate)?/i,
            );
            let collegeGrad: number | null = (() => {
              const directMatch = combinedText.match(
                /\$([\d,]+)\s+College\s+Graduate\s+Bonus/i,
              );
              if (directMatch && directMatch[1]) return parseNumber(directMatch[1]);
              return extractAmountNearKeyword(
                combinedText,
                /college\s+graduate\s+bonus|college\s+grad(?:uate)?/i,
              );
            })();
            const firstResponder = extractAmountNearKeyword(
              combinedText,
              /first\s+responders?\s+bonus|first\s*responder\s*(?:discount|bonus|rebate)?/i,
            );

            // Only create offer if we have meaningful data
            if (aprRate !== null) {
              offers.push({
                brand: "BMW",
                year: year ? parseInt(String(year), 10) : null,
                make: "BMW",
                model: modelName,
                modelCode: modelCode,
                trim: trim,
                offerType: "financing",
                offerAmount: null,
                aprRate: aprRate,
                aprTermMonths: aprTermMonths,
                leaseTermMonths: null,
                cashValue: null,
                tradeDiscount: null,
                leaseDueAtSigning: null,
                leaseMonthlyPayment: null,
                milesPerYear: null,
                expirationDate: expirationDate,
                terms: terms,
                finePrint: finePrint,
                loyaltyBonus: loyaltyBonus ?? null,
                conquestBonus: conquestBonus ?? null,
                militaryDiscount: militaryDiscount ?? null,
                collegeGrad: collegeGrad ?? null,
                firstResponder: firstResponder ?? null,
                scrapedAt: scrapedAt,
                sourceUrl: BMW_SOURCE_URL,
              });
            }
          }
        }
      }

      console.log("BMW incentives found:", offers.length);

      const result = await storeScrapedIncentives({
        brand: "BMW",
        offers: offers as NormalizedIncentiveOffer[],
        source: "bmw",
        scrapeEventId,
      });
      if (!result.success) {
        return { success: false, totalOffers: 0, error: result.error };
      }
      return { success: true, totalOffers: result.stored };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      // Handle timeout/abort errors specifically
      if (fetchError.name === "AbortError" || fetchError.code === "ETIMEDOUT") {
        console.error("BMW API request timed out:", fetchError.message);
        throw new Error("BMW API request timed out after 30 seconds");
      }
      // Re-throw other fetch errors
      throw fetchError;
    }
  } catch (error: any) {
    console.error("Error scraping BMW offers:", error);
    const message = error?.message || "Internal server error while scraping BMW offers";
    await markScrapeEventFailed(scrapeEventId, message, {
      brand: "BMW",
      source: "bmw",
    });
    return { success: false, error: message };
  }
}
