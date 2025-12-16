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

// Parse expiration date from format "M-D-YYYY" (e.g., "1-2-2026")
function parseExpirationDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const parts = dateStr.split("-");
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

// Extract monthly payment from text (e.g., "$999/month")
function extractMonthlyPayment(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/\$([\d,]+)\/month/i);
    if (match && match[1]) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract term months from text (e.g., "for 36 months")
function extractTermMonths(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/for\s+(\d+)\s+months?/i);
    if (match && match[1]) {
      const term = parseInt(match[1], 10);
      if (!isNaN(term) && term > 0) return term;
    }
    return null;
  } catch {
    return null;
  }
}

// Extract due at signing amount from text (e.g., "$10,859 due at signing")
function extractDueAtSigning(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/\$([\d,]+)\s+due\s+at\s+signing/i);
    if (match && match[1]) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract APR from text (e.g., "0.9% APR" or "APR 0.9%")
function extractAPR(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/(\d+\.?\d*)\s*%?\s*apr/i);
    if (match && match[1]) {
      const apr = parseFloat(match[1]);
      if (!isNaN(apr) && apr >= 0 && apr <= 100) {
        return apr / 100; // Convert percentage to decimal
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function scrapeOffersFromGMC() {
  try {
    const myHeaders = new Headers();
    const requestOptions = {
      method: "GET",
      headers: myHeaders,
      redirect: "follow" as RequestRedirect,
    };

    const response = await fetch(
      "https://cws.gm.com/cof-cws/v2/currentoffers/US/en/95556?make=gmc&quantumHostname=www.gmc.com",
      requestOptions,
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("GMC API error:", response.status, text.substring(0, 500));
      throw new Error(`GMC API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data?.results || !Array.isArray(data.results)) {
      console.error("Unexpected API response structure:", JSON.stringify(data, null, 2));
      return { success: false, error: "Unexpected API response structure" };
    }

    const offers: any[] = [];
    const scrapedAt = new Date();

    // Process each offer result
    for (const result of data.results) {
      // Skip "Featured Offer" type - these don't have actual offer data
      if (result.offerType === "Featured Offer") {
        continue;
      }

      // Extract basic vehicle information
      const brand = "GMC";
      const year = result.modelYear ? parseInt(result.modelYear, 10) : null;
      const model = result.displayName || result.carline || null;
      const carline = result.carline || null;
      const bodystyle = result.bodystyle || null;
      const trims = result.trims && Array.isArray(result.trims) ? result.trims : [];
      const trim = trims.length > 0 ? trims.join(", ") : null;

      // Map offer type
      let offerType = "cash";
      if (result.offerType === "Lease") {
        offerType = "lease";
      } else if (result.offerType === "Finance") {
        offerType = "financing";
      } else if (result.offerType === "Cash") {
        offerType = "cash";
      }

      // Extract offer details from offerText
      const offerText = result.offerText || {};
      const bodyText = offerText.body?.text || "";
      const footerText = offerText.footer?.text || "";
      const titleText = offerText.title?.text || "";

      // Extract monthly payment
      const monthlyPayment = extractMonthlyPayment(bodyText);

      // Extract term months
      const termMonths = extractTermMonths(bodyText);

      // Extract due at signing
      const dueAtSigning = extractDueAtSigning(bodyText);

      // Extract APR (usually in body or footer text)
      const apr = extractAPR(bodyText) || extractAPR(footerText);

      // Extract expiration date
      const expirationDate = parseExpirationDate(result.endEffDate);

      // Build terms text from body
      const terms = bodyText.trim() || null;

      // Build fine print from footer
      const finePrint = footerText.trim() || null;

      // Don't populate offerAmount from monthlyPayment or cashBack - keep them separate
      // offerAmount should only be set if explicitly extracted from the offer content
      let offerAmount: number | null = null;
      
      // Extract cashBack for cash offers from body text
      let cashBack: number | null = null;
      if (offerType === "cash") {
        // Look for patterns like "$X,XXX cash back" or "$X,XXX off"
        const cashBackMatch = bodyText.match(/\$([\d,]+)\s+(?:cash\s+back|off|discount)/i);
        if (cashBackMatch && cashBackMatch[1]) {
          cashBack = parseNumber(cashBackMatch[1]);
        }
      }

      // Only create offer if we have meaningful data
      const hasValidData =
        (offerType === "lease" && monthlyPayment) ||
        (offerType === "financing" && apr !== null) ||
        (offerType === "cash" && (offerAmount !== null || cashBack !== null));

      if (!hasValidData) {
        console.warn(`Skipping ${offerType} offer for ${model} ${year} - insufficient data`);
        continue;
      }

      offers.push({
        brand,
        year,
        make: brand,
        model,
        modelCode: carline,
        trim,
        offerType,
        offerAmount,
        apr,
        termMonths,
        cashBack,
        dueAtSigning,
        monthlyPayment,
        milesPerYear: null, // Could extract from terms if needed
        expirationDate,
        terms,
        finePrint,
        scrapedAt,
      });
    }

    console.log("GMC offers found:", offers.length);

    // Delete all existing GMC offers first
    await prisma.offers.deleteMany({
      where: {
        brand: "GMC",
      },
    });
    console.log("Deleted all existing GMC offers");

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
          console.error("Error storing GMC offer batch:", err?.message || err);
        }
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping GMC offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping GMC offers",
    };
  }
}

