import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

// Extract due at signing amount from text (e.g., "with $3,999 due at lease signing")
function extractDueAtSigning(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/\$([\d,]+)\s+due\s+at\s+(lease\s+)?signing/i);
    if (match) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

interface HyundaiOffer {
  brand: string;
  year: number | null;
  make: string;
  model: string;
  modelCode: string | null;
  trim: string | null;
  offerType: "lease" | "financing" | "cash";
  offerAmount: number | null;
  apr: number | null;
  termMonths: number | null;
  cashBack: number | null;
  dueAtSigning: number | null;
  monthlyPayment: number | null;
  milesPerYear: number | null;
  terms: string | null;
  finePrint: string | null;
  expirationDate: Date | null;
  scrapedAt: Date;
}

export async function scrapeOffersFromHyundai(zipCode: string = "95556") {
  try {
    const url = `https://www.hyundaiusa.com/var/hyundai/services/incentiveAws.featuredOfferByZip.service?brand=hyundai&zip=${zipCode}`;
    
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Hyundai API error:", response.status, text.substring(0, 500));
      throw new Error(`Hyundai API request failed: ${response.status}`);
    }

    const text = await response.text();
    let data: any;
    
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse Hyundai API response as JSON:", text.substring(0, 500));
      throw new Error("Invalid JSON response from Hyundai API");
    }

    if (!data?.data || !Array.isArray(data.data)) {
      console.error("Unexpected API response structure:", data);
      return { success: false, error: "Unexpected API response structure" };
    }

    const offers: HyundaiOffer[] = [];
    const scrapedAt = new Date();

    // Process each data item (typically one per state/region)
    for (const dataItem of data.data) {
      const years = dataItem.years || [];
      
      // Process each year
      for (const yearData of years) {
        const modelYear = yearData.modelYear;
        const vehicles = yearData.vehicles || [];
        
        // Process each vehicle
        for (const vehicle of vehicles) {
          const modelName = vehicle.modelName || "";
          const modelGroupCode = vehicle.modelGroupCode || null;
          const cardOrder = vehicle.cardOrder || {};
          
          // Process lease1 offer
          if (cardOrder.lease1) {
            const lease1 = cardOrder.lease1;
            const dueAtSigning = extractDueAtSigning(lease1.header || lease1.shortDescription);
            
            offers.push({
              brand: "Hyundai",
              year: modelYear,
              make: "Hyundai",
              model: modelName,
              modelCode: modelGroupCode,
              trim: lease1.trimName || null,
              offerType: "lease",
              offerAmount: lease1.offerMonthlyPayment || null,
              apr: null,
              termMonths: lease1.term || null,
              cashBack: null,
              dueAtSigning,
              monthlyPayment: lease1.offerMonthlyPayment || null,
              milesPerYear: null,
              terms: lease1.shortDescription || null,
              finePrint: lease1.disclaimer || null,
              expirationDate: parseDate(lease1.endDate),
              scrapedAt,
            });
          }
          
          // Process lease2 offer
          if (cardOrder.lease2) {
            const lease2 = cardOrder.lease2;
            const dueAtSigning = extractDueAtSigning(lease2.header || lease2.shortDescription);
            
            offers.push({
              brand: "Hyundai",
              year: modelYear,
              make: "Hyundai",
              model: modelName,
              modelCode: modelGroupCode,
              trim: lease2.trimName || null,
              offerType: "lease",
              offerAmount: lease2.offerMonthlyPayment || null,
              apr: null,
              termMonths: lease2.term || null,
              cashBack: null,
              dueAtSigning,
              monthlyPayment: lease2.offerMonthlyPayment || null,
              milesPerYear: null,
              terms: lease2.shortDescription || null,
              finePrint: lease2.disclaimer || null,
              expirationDate: parseDate(lease2.endDate),
              scrapedAt,
            });
          }
          
          // Process lowApr (financing) offer
          if (cardOrder.lowApr) {
            const lowApr = cardOrder.lowApr;
            const apr = lowApr.apr !== undefined && lowApr.apr !== null ? lowApr.apr / 100 : null;
            
            offers.push({
              brand: "Hyundai",
              year: modelYear,
              make: "Hyundai",
              model: modelName,
              modelCode: modelGroupCode,
              trim: lowApr.trimName || null,
              offerType: "financing",
              offerAmount: null,
              apr,
              termMonths: lowApr.term || null,
              cashBack: lowApr.hmfBonusCash || null,
              dueAtSigning: null,
              monthlyPayment: null,
              milesPerYear: null,
              terms: lowApr.shortDescription || null,
              finePrint: lowApr.disclaimer || null,
              expirationDate: parseDate(lowApr.endDate),
              scrapedAt,
            });
          }
          
          // Process savings (cash) offer
          if (cardOrder.savings) {
            const savings = cardOrder.savings;
            
            offers.push({
              brand: "Hyundai",
              year: modelYear,
              make: "Hyundai",
              model: modelName,
              modelCode: modelGroupCode,
              trim: savings.trimName || null,
              offerType: "cash",
              offerAmount: savings.price || null,
              apr: null,
              termMonths: null,
              cashBack: savings.price || null,
              dueAtSigning: null,
              monthlyPayment: null,
              milesPerYear: null,
              terms: savings.shortDescription || null,
              finePrint: savings.disclaimer || null,
              expirationDate: parseDate(savings.endDate),
              scrapedAt,
            });
          }
        }
      }
    }

    console.log("Hyundai offers found:", offers.length);

    // Delete all existing Hyundai offers first
    await prisma.offers.deleteMany({
      where: {
        brand: "Hyundai",
      },
    });
    console.log("Deleted all existing Hyundai offers");

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
          console.error("Error storing Hyundai offer batch:", err?.message || err);
        }
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Hyundai offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Hyundai offers",
    };
  }
}

