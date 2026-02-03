import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Trim leading/trailing whitespace and collapse internal runs of whitespace (spaces, newlines, tabs) to a single space
function normalizeDescriptionText(str: string | null | undefined): string {
  if (str == null || typeof str !== "string") return "";
  return str.replace(/\s+/g, " ").trim();
}

// Strip HTML from fine print: remove tags, convert block/line-break elements to \n, decode entities
function stripHtmlToText(html: string | null | undefined): string {
  if (html == null || typeof html !== "string") return "";
  let text = html;
  // Convert line and block breaks to newline before stripping tags
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p\s*>/gi, "\n");
  text = text.replace(/<p\s*[^>]*>/gi, "\n");
  text = text.replace(/<\/div\s*>/gi, "\n");
  text = text.replace(/<div\s*[^>]*>/gi, "\n");
  text = text.replace(/<\/li\s*>/gi, "\n");
  text = text.replace(/<li\s*[^>]*>/gi, "\n");
  text = text.replace(/<\/tr\s*>/gi, "\n");
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  // Collapse multiple newlines to single \n, trim each line and overall
  text = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
  return text.trim();
}

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

// Extract dollar amount near a keyword (e.g. "$500 military" or "military discount $500") for schema bonus/discount fields
function extractAmountNearKeyword(
  text: string | null | undefined,
  keyword: RegExp,
): number | null {
  if (!text) return null;
  try {
    // Match keyword then $X,XXX within ~80 chars
    const afterKeyword = new RegExp(
      `${keyword.source}[\\s\\S]{0,80}?\\$([\\d,]+)`,
      "i",
    );
    let match = text.match(afterKeyword);
    if (match && match[1]) return parseNumber(match[1]);
    // Match $X,XXX then keyword within ~80 chars
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

export async function scrapeOffersFromCadillac() {
  try {
    const myHeaders = new Headers();
    const requestOptions = {
      method: "GET",
      headers: myHeaders,
      redirect: "follow" as RequestRedirect,
    };

    // API URL used for scraping (internal); sourceUrl is the public page users can visit
    const cadillacApiUrl =
      "https://cws.gm.com/cof-cws/v2/currentoffers/US/en/95556?make=cadillac&quantumHostname=www.cadillac.com";
    const sourceUrl = "https://www.cadillac.com/offers/current";
    const response = await fetch(cadillacApiUrl, requestOptions);

    if (!response.ok) {
      const text = await response.text();
      console.error("Cadillac API error:", response.status, text.substring(0, 500));
      throw new Error(`Cadillac API request failed: ${response.status}`);
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
      const brand = "Cadillac";
      const year = result.modelYear ? parseInt(result.modelYear, 10) : null;
      const model = result.displayName || result.carline || null;
      const carline = result.carline || null;
      const bodystyle = result.bodystyle || null;
      const trims = result.trims && Array.isArray(result.trims) ? result.trims : [];
      const trim = trims.length > 0 ? trims.join(", ") : null;

      // Map offer type
      let offerType: "cash" | "financing" | "lease" = "cash";
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
      const leaseMonthlyPayment = extractMonthlyPayment(bodyText);

      // Extract term months
      const leaseTermMonths = extractTermMonths(bodyText);
      const aprTermMonths = extractTermMonths(bodyText); // For financing offers

      // Extract due at signing
      const leaseDueAtSigning = extractDueAtSigning(bodyText);

      // Extract APR (usually in body or footer text)
      const aprRate = extractAPR(bodyText) || extractAPR(footerText);

      // Extract expiration date
      const expirationDate = parseExpirationDate(result.endEffDate);

      // Build terms (description) from body - remove leading/trailing and collapse internal whitespace
      const termsRaw = normalizeDescriptionText(bodyText);
      const terms = termsRaw.length > 0 ? termsRaw : null;

      // Build fine print from footer: strip HTML, keep only text with \n for line/block breaks
      const finePrintRaw = stripHtmlToText(footerText);
      const finePrint = finePrintRaw.length > 0 ? finePrintRaw : null;

      // Don't populate offerAmount from monthlyPayment or cashBack - keep them separate
      // offerAmount should only be set if explicitly extracted from the offer content
      let offerAmount: number | null = null;

      // Extract cashValue for cash offers from body text
      let cashValue: number | null = null;
      if (offerType === "cash") {
        // Look for patterns like "$X,XXX Purchase Allowance", "$X,XXX Competitive Cash Allowance", "$X,XXX Costco Executive Member Incentive"
        const cashBackMatch = bodyText.match(
          /\$([\d,]+)\s+(?:Purchase\s+Allowance|Competitive\s+Cash\s+Allowance|Costco\s+Executive\s+Member\s+Incentive|off|discount)/i,
        );
        if (cashBackMatch && cashBackMatch[1]) {
          cashValue = parseNumber(cashBackMatch[1]);
        }
        // Also check for standalone dollar amounts in cash offers
        if (!cashValue) {
          const standaloneMatch = bodyText.match(/\$([\d,]+)/);
          if (standaloneMatch && standaloneMatch[1]) {
            cashValue = parseNumber(standaloneMatch[1]);
          }
        }
      }

      // Optional: extract bonus/discount amounts from body+footer when API text mentions them (no structured fields in API)
      const combinedText = `${bodyText} ${footerText}`;
      const loyaltyBonus = extractAmountNearKeyword(
        combinedText,
        /loyalty|current\s+lessees?\s+of\s+.*\s+GM\s+vehicles/i,
      );
      const conquestBonus = extractAmountNearKeyword(
        combinedText,
        /conquest|non-GM\s+vehicles|current\s+lessees?\s+of\s+.*\s+non-GM/i,
      );
      const militaryDiscount = extractAmountNearKeyword(
        combinedText,
        /military/i,
      );
      const collegeGrad = extractAmountNearKeyword(
        combinedText,
        /college\s+grad|college\s+graduate/i,
      );
      const firstResponder = extractAmountNearKeyword(
        combinedText,
        /first\s+responder/i,
      );

      // Only create offer if we have meaningful data
      const hasValidData =
        (offerType === "lease" && leaseMonthlyPayment) ||
        (offerType === "financing" && aprRate !== null) ||
        (offerType === "cash" && (offerAmount !== null || cashValue !== null));

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
        aprRate,
        aprTermMonths: offerType === "financing" ? aprTermMonths : null,
        leaseTermMonths: offerType === "lease" ? leaseTermMonths : null,
        cashValue,
        leaseDueAtSigning,
        leaseMonthlyPayment,
        milesPerYear: null, // Could extract from terms if needed
        expirationDate,
        terms,
        finePrint,
        scrapedAt,
        sourceUrl,
        loyaltyBonus: loyaltyBonus ?? null,
        conquestBonus: conquestBonus ?? null,
        militaryDiscount: militaryDiscount ?? null,
        collegeGrad: collegeGrad ?? null,
        firstResponder: firstResponder ?? null,
      });
    }

    console.log("Cadillac offers found:", offers.length);

    // Delete all existing Cadillac offers first
    await prisma.offers.deleteMany({
      where: {
        brand: "Cadillac",
      },
    });
    console.log("Deleted all existing Cadillac offers");

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
                  milesPerYear: offer.milesPerYear,
                  terms: offer.terms,
                  finePrint: offer.finePrint,
                  expirationDate: offer.expirationDate,
                  scrapedAt: offer.scrapedAt,
                  sourceUrl: offer.sourceUrl ?? null,
                  loyaltyBonus: offer.loyaltyBonus ?? null,
                  conquestBonus: offer.conquestBonus ?? null,
                  militaryDiscount: offer.militaryDiscount ?? null,
                  collegeGrad: offer.collegeGrad ?? null,
                  firstResponder: offer.firstResponder ?? null,
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
          console.error("Error storing Cadillac offer batch:", err?.message || err);
        }
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Cadillac offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Cadillac offers",
    };
  }
}
