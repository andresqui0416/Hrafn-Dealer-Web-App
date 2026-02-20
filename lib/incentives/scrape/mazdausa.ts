import {
  createScrapeEvent,
  markScrapeEventFailed,
  storeScrapedIncentives,
  type NormalizedIncentiveOffer,
} from "@/lib/incentives/storeScrapedIncentives";

const MAZDA_SOURCE_URL =
  "https://www.mazdausa.com/shopping-tools/special-offers-and-incentives";

// Parse date from format "1/5/2026" or "01/05/2026"
function parseMazdaDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

// Parse number from string, removing commas and dollar signs
function parseNumber(str: string | null | undefined): number | null {
  if (!str) return null;
  try {
    const cleaned = str.replace(/[,$]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

function extractAmountNearKeyword(
  text: string | null | undefined,
  keywords: string[],
): number | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const keyword of keywords) {
    const keywordIndex = lower.indexOf(keyword.toLowerCase());
    if (keywordIndex === -1) continue;

    const windowStart = Math.max(0, keywordIndex - 120);
    const windowEnd = Math.min(text.length, keywordIndex + keyword.length + 120);
    const windowText = text.slice(windowStart, windowEnd);

    const amountMatch = windowText.match(/\$?\s*([\d,.]+)/);
    if (amountMatch && amountMatch[1]) {
      const cleaned = amountMatch[1].replace(/,/g, "");
      const value = parseFloat(cleaned);
      if (!Number.isNaN(value)) {
        return value;
      }
    }
  }

  return null;
}

function extractMazdaBonuses(text: string | null | undefined) {
  const loyaltyBonus = extractAmountNearKeyword(text, ["loyalty", "owner loyalty"]);
  const conquestBonus = extractAmountNearKeyword(text, [
    "conquest",
    "competitive bonus",
  ]);
  const militaryDiscount = extractAmountNearKeyword(text, [
    "military",
    "service member",
  ]);
  const collegeGrad = extractAmountNearKeyword(text, [
    "college",
    "graduate",
    "graduation",
  ]);
  const firstResponder = extractAmountNearKeyword(text, [
    "first responder",
    "firefighter",
    "police",
    "emt",
  ]);

  return {
    loyaltyBonus,
    conquestBonus,
    militaryDiscount,
    collegeGrad,
    firstResponder,
  };
}

const MAZDA_BRAND = "Mazda";
const MAZDA_SOURCE = "mazda";

export async function scrapeOffersFromMazda() {
  const { scrapeEventId } = await createScrapeEvent({
    brand: MAZDA_BRAND,
    source: MAZDA_SOURCE,
  });
  try {
    const mazdaApiUrl =
      "https://www.mazdausa.com/api/incentives/v3/95556?blockid=824742";
    const response = await fetch(mazdaApiUrl, {
      method: "GET",
      redirect: "follow",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Mazda API error:", response.status, text);
      throw new Error(`Mazda API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data?.body?.vehicles || !Array.isArray(data.body.vehicles)) {
      console.error("Unexpected API response structure:", JSON.stringify(data, null, 2));
      return { success: false, error: "Unexpected API response structure" };
    }

    const offers: any[] = [];
    const scrapedAt = new Date();

    // Process each vehicle
    for (const vehicle of data.body.vehicles) {
      const vehicleSpecialOffers = vehicle.vehicleSpecialOffers || [];
      for (const vehicleSpecialOffer of vehicleSpecialOffers) {
        const modelName = vehicleSpecialOffer.modelName || "";
        const year = parseNumber(vehicleSpecialOffer.modelYear) || null;
        const modelCode = vehicleSpecialOffer.modelCode || null;
        // Process lease offers
        if (Array.isArray(vehicleSpecialOffer.leaseOffers)) {
          for (const leaseOffer of vehicleSpecialOffer.leaseOffers) {
            const trimCode = leaseOffer.offerTrimCode || leaseOffer.vehicleTrimCode || "";
            const expirationDate = parseMazdaDate(leaseOffer.expirationDate);
            const leaseMonthlyPayment = parseNumber(leaseOffer.monthlyPayment);
            const leaseDueAtSigning = parseNumber(leaseOffer.dueAtSigning);
            const leaseTermMonths = parseNumber(leaseOffer.leaseTerm);
            const cashValue = parseNumber(leaseOffer.leaseCashBack);

            // Validate: skip lease offers without a monthly payment value
            if (leaseMonthlyPayment === null) {
              continue;
            }

            const combinedText = [
              leaseOffer.description,
              leaseOffer.disclaimer,
            ]
              .filter(Boolean)
              .join(" ");

            const {
              loyaltyBonus,
              conquestBonus,
              militaryDiscount,
              collegeGrad,
              firstResponder,
            } = extractMazdaBonuses(combinedText);

            offers.push({
              header: leaseOffer.header || null,
              brand: "Mazda",
              year,
              make: "Mazda",
              model: modelName,
              modelCode,
              trim: trimCode || null,
              offerType: "lease",
              offerAmount: null,
              aprRate: null,
              aprTermMonths: null,
              leaseTermMonths,
              cashValue: cashValue,
              leaseDueAtSigning,
              leaseMonthlyPayment,
              milesPerYear: null, // Could extract from description if needed
              loyaltyBonus,
              conquestBonus,
              militaryDiscount,
              collegeGrad,
              firstResponder,
              expirationDate,
              terms: leaseOffer.description || leaseOffer.header || null,
              finePrint: leaseOffer.disclaimer || null,
              scrapedAt,
              sourceUrl: MAZDA_SOURCE_URL,
            });
          }
        }

        // Process purchase offers (financing)
        if (Array.isArray(vehicleSpecialOffer.purchaseOffers)) {
          for (const purchaseOffer of vehicleSpecialOffer.purchaseOffers) {
            const trimCode = purchaseOffer.offerTrimCode || purchaseOffer.vehicleTrimCode || "";
            const expirationDate = parseMazdaDate(purchaseOffer.expirationDate);
            const aprRate = parseNumber(purchaseOffer.apr);
            const aprTermMonths = parseNumber(purchaseOffer.paymentTerm);
            const cashValue = parseNumber(purchaseOffer.cashBack);

            // Validate: skip purchase offers that have neither APR nor cash value
            if (aprRate === null && cashValue === null) {
              continue;
            }

            const combinedText = [
              purchaseOffer.description,
              purchaseOffer.disclaimer,
            ]
              .filter(Boolean)
              .join(" ");

            const {
              loyaltyBonus,
              conquestBonus,
              militaryDiscount,
              collegeGrad,
              firstResponder,
            } = extractMazdaBonuses(combinedText);

            // Determine offer type: if there's cashValue, it's cash, otherwise financing
            const offerType = cashValue && cashValue > 0 ? "cash" : "financing";

            offers.push({
              header: purchaseOffer.header || null,
              brand: "Mazda",
              year,
              make: "Mazda",
              model: modelName,
              modelCode,
              trim: trimCode || null,
              offerType,
              offerAmount: null,
              aprRate: aprRate !== null ? aprRate / 100 : null, // Convert percentage to decimal (5.9 -> 0.059)
              aprTermMonths: offerType === "financing" ? aprTermMonths : null,
              leaseTermMonths: null,
              cashValue,
              leaseDueAtSigning: null,
              leaseMonthlyPayment: null,
              milesPerYear: null,
              loyaltyBonus,
              conquestBonus,
              militaryDiscount,
              collegeGrad,
              firstResponder,
              expirationDate,
              terms: purchaseOffer.description || purchaseOffer.header || null,
              finePrint: purchaseOffer.disclaimer || null,
              scrapedAt,
              sourceUrl: MAZDA_SOURCE_URL,
            });
          }
        }
      }

      //   // Process special offers (cash offers)
      //   if (Array.isArray(vehicleSpecialOffers.specialOffersWithVehicles)) {
      //     for (const specialOffer of vehicleSpecialOffers.specialOffersWithVehicles) {
      //       const trimCode = specialOffer.offerTrimCode || specialOffer.vehicleTrimCode || "";
      //       const year = extractYearFromTrimCode(trimCode);
      //       const expirationDate = parseMazdaDate(specialOffer.expirationDate);

      //       // Try to extract cash amount from header (e.g., "$500 Mazda Military Appreciation Bonus Cash")
      //       let cashBack: number | null = null;
      //       const headerMatch = specialOffer.header?.match(/\$([\d,]+)/);
      //       if (headerMatch) {
      //         cashBack = parseNumber(headerMatch[1]);
      //       }

      //       offers.push({
      //         brand: "Mazda",
      //         year,
      //         make: "Mazda",
      //         model: modelName,
      //         modelCode,
      //         trim: trimCode || null,
      //         offerType: "cash",
      //         offerAmount: cashBack,
      //         apr: null,
      //         termMonths: null,
      //         cashBack,
      //         dueAtSigning: null,
      //         monthlyPayment: null,
      //         milesPerYear: null,
      //         expirationDate,
      //         terms: specialOffer.description || specialOffer.header || null,
      //         finePrint: specialOffer.disclaimer || null,
      //         scrapedAt,
      //       });
      //     }
      //   }
    }

    console.log("Mazda incentives found:", offers.length);

    const brand = offers.length > 0 ? offers[0].brand : MAZDA_BRAND;
    const result = await storeScrapedIncentives({
      brand,
      offers: offers as NormalizedIncentiveOffer[],
      source: MAZDA_SOURCE,
      scrapeEventId,
    });
    if (!result.success) {
      return { success: false, totalOffers: 0, error: result.error };
    }
    return { success: true, totalOffers: result.stored };
  } catch (error: any) {
    console.error("Error scraping Mazda offers:", error);
    const message = error?.message || "Internal server error while scraping Mazda offers";
    await markScrapeEventFailed(scrapeEventId, message, {
      brand: MAZDA_BRAND,
      source: MAZDA_SOURCE,
    });
    return { success: false, error: message };
  }
}
