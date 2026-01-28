import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

export async function scrapeOffersFromMazda() {
  try {
    const response = await fetch(
      "https://www.mazdausa.com/api/incentives/v3/95556?blockid=824742",
      {
        method: "GET",
        redirect: "follow",
      },
    );

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
              expirationDate,
              terms: leaseOffer.description || leaseOffer.header || null,
              finePrint: leaseOffer.disclaimer || null,
              scrapedAt,
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
              aprRate: aprRate ? aprRate / 100 : null, // Convert percentage to decimal (5.9 -> 0.059)
              aprTermMonths: offerType === "financing" ? aprTermMonths : null,
              leaseTermMonths: null,
              cashValue,
              leaseDueAtSigning: null,
              leaseMonthlyPayment: null,
              milesPerYear: null,
              expirationDate,
              terms: purchaseOffer.description || purchaseOffer.header || null,
              finePrint: purchaseOffer.disclaimer || null,
              scrapedAt,
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

    console.log("Mazda offers found:", offers.length);

    // Delete all existing offers for this brand first
    const brand = offers.length > 0 ? offers[0].brand : "Mazda";
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
          console.error("Error storing Mazda offer batch:", err?.message || err);
        }
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Mazda offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Mazda offers",
    };
  }
}
