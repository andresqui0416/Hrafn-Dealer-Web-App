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

export async function scrapeOffersFromBMW() {
  try {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(
        "https://www.bmwusa.com/offers-api/current-offers/v2?bySeries=true",
        {
          method: "GET",
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            Referer: "https://www.bmwusa.com/",
            Origin: "https://www.bmwusa.com",
          },
          redirect: "follow" as RequestRedirect,
        },
      );

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
                scrapedAt: scrapedAt,
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
                scrapedAt: scrapedAt,
              });
            }
          }
        }
      }

      console.log("BMW offers found:", offers.length);

      // Delete all existing BMW offers first
      await prisma.offers.deleteMany({
        where: {
          brand: "BMW",
        },
      });
      console.log("Deleted all existing BMW offers");

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
            console.error("Error storing BMW offer batch:", err?.message || err);
          }
        }
      }

      return { success: true, totalOffers: offers.length };
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
    return {
      success: false,
      error: error?.message || "Internal server error while scraping BMW offers",
    };
  }
}
