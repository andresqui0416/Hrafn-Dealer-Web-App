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

interface KiaOffer {
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

export async function scrapeOffersFromKia(zipCode: string = "95556") {
  try {
    const url = `https://www.kia.com/us/services/en/offers/${zipCode}`;
    
    // Build the request body with all vehicle series and years
    const vehicles = [
      { seriesId: "B", year: 2025 },
      { seriesId: "B", year: 2026 },
      { seriesId: "SP2", year: 2025 },
      { seriesId: "SP2", year: 2026 },
      { seriesId: "4", year: 2025 },
      { seriesId: "4", year: 2026 },
      { seriesId: "7", year: 2025 },
      { seriesId: "7", year: 2026 },
      { seriesId: "J", year: 2025 },
      { seriesId: "J", year: 2026 },
      { seriesId: "M", year: 2025 },
      { seriesId: "M", year: 2026 },
      { seriesId: "G", year: 2025 },
      { seriesId: "G", year: 2026 },
      { seriesId: "S", year: 2025 },
      { seriesId: "S", year: 2026 },
      { seriesId: "F", year: 2025 },
      { seriesId: "F", year: 2026 },
      { seriesId: "U", year: 2025 },
      { seriesId: "U", year: 2026 },
      { seriesId: "V", year: 2025 },
      { seriesId: "V", year: 2026 },
      { seriesId: "R", year: 2025 },
      { seriesId: "R", year: 2026 },
      { seriesId: "Q", year: 2025 },
      { seriesId: "Q", year: 2026 },
      { seriesId: "N", year: 2025 },
      { seriesId: "N", year: 2026 },
      { seriesId: "T", year: 2025 },
      { seriesId: "T", year: 2026 },
      { seriesId: "P", year: 2025 },
      { seriesId: "P", year: 2026 },
      { seriesId: "2", year: 2025 },
      { seriesId: "2", year: 2026 },
      { seriesId: "51", year: 2025 },
      { seriesId: "51", year: 2026 },
    ];

    const requestBody = {
      vehicles,
      categories: [3, 2, 1, 4], // Cash, Lease, Finance, and other categories
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://www.kia.com",
        "Referer": "https://www.kia.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
        throw new Error(`Kia API request failed: ${response.status} - Server returned HTML error page. The API may require authentication or the endpoint may have changed.`);
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
        console.error("Kia API returned HTML instead of JSON. Response preview:", text.substring(0, 500));
        throw new Error("Kia API returned HTML error page instead of JSON. The endpoint may require authentication or may have changed.");
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
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Origin": "https://www.kia.com",
            "Referer": `https://www.kia.com/us/en/offers`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
      let monthlyPayment: number | null = null;
      let apr: number | null = null;
      let cashBack: number | null = null;
      let offerAmount: number | null = null;
      let termMonths: number | null = null;
      let dueAtSigning: number | null = null;
      let bonusCash: number | null = null;
      
      if (offerType === "lease") {
        monthlyPayment = extractMonthlyPayment(finalTitle);
        offerAmount = monthlyPayment;
        termMonths = extractTermMonths(finalHeading);
        dueAtSigning = extractDueAtSigning(finalDescription);
        bonusCash = extractBonusCash(finalHeading);
        cashBack = bonusCash;
      } else if (offerType === "financing") {
        apr = extractApr(finalTitle);
        termMonths = extractTermMonths(finalHeading);
        bonusCash = extractBonusCash(finalHeading);
        cashBack = bonusCash;
      } else if (offerType === "cash") {
        cashBack = extractCashAmount(finalTitle);
        offerAmount = cashBack;
        // Also check includedCashOffers for total amount
        if (offer.includedCashOffers && Array.isArray(offer.includedCashOffers)) {
          // Try to extract total from included offers
          const totalMatch = finalTitle.match(/(?:up\s+to\s+)?\$([\d,]+)/i);
          if (totalMatch) {
            cashBack = parseNumber(totalMatch[1]);
            offerAmount = cashBack;
          }
        }
      }
      
      // Build terms string
      const termsParts: string[] = [];
      if (finalTitle) termsParts.push(finalTitle);
      if (finalHeading) termsParts.push(finalHeading);
      if (finalDescriptionText) termsParts.push(finalDescriptionText);
      const terms = termsParts.join(" ").trim() || null;
      
      offers.push({
        brand: "Kia",
        year: modelYear,
        make: "Kia",
        model: modelName,
        modelCode: seriesId,
        trim: finalTrimName,
        offerType,
        offerAmount,
        apr,
        termMonths,
        cashBack,
        dueAtSigning,
        monthlyPayment,
        milesPerYear: null,
        terms,
        finePrint,
        expirationDate: parseDate(offer.endDate),
        scrapedAt,
      });
    }

    console.log("Kia offers found:", offers.length);

    // Delete all existing Kia offers first
    await prisma.offers.deleteMany({
      where: {
        brand: "Kia",
      },
    });
    console.log("Deleted all existing Kia offers");

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
          console.error("Error storing Kia offer batch:", err?.message || err);
        }
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Kia offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Kia offers",
    };
  }
}

