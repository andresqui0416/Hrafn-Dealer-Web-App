import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper function to extract text content from HTML
function extractTextFromHTML(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;br\/&gt;/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract number from text (removes $, commas, etc.)
function extractNumber(text: string): number | null {
  const match = text.replace(/[^0-9.]/g, "");
  const num = parseFloat(match);
  return isNaN(num) ? null : num;
}

// Extract year and model from headline (e.g., "2025 Macan Electric" -> {year: 2025, model: "Macan Electric"})
function parseModelYear(headline: string): { year: number | null; model: string } {
  const match = headline.match(/^(\d{4})\s+(.+)$/);
  if (match) {
    return {
      year: parseInt(match[1], 10),
      model: match[2].trim(),
    };
  }
  // Fallback: try to extract year from anywhere in the string
  const yearMatch = headline.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  return {
    year,
    model: headline.replace(/\d{4}\s*/, "").trim() || headline,
  };
}

// Extract due at signing amount from text (e.g., "$8,419 due from customer at lease signing" -> 8419)
function extractDueAtSigning(text: string): number | null {
  const match = text.match(/\$([\d,]+)/);
  if (match) {
    return extractNumber(match[0]);
  }
  return null;
}

// Extract expiration date from terms text
function extractExpirationDate(text: string): string | null {
  // Look for pattern "Must take delivery by 1/02/2026"
  const pattern = /must take delivery by\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;
  const match = text.match(pattern);

  if (match) {
    try {
      const dateStr = match[1];
      const [month, day, year] = dateStr.split("/");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

// Extract miles per year from terms text (e.g., "$.30/mile over 32,500 miles" -> 32500)
function extractMilesPerYear(text: string): number | null {
  // Look for patterns like "over 32,500 miles" or "over 32500 miles"
  const pattern = /over\s+([\d,]+)\s+miles/i;
  const match = text.match(pattern);

  if (match) {
    const milesStr = match[1].replace(/,/g, "");
    const miles = parseInt(milesStr, 10);
    return isNaN(miles) ? null : miles;
  }
  return null;
}

const fetchOfferData = async () => {
  const url =
    "https://www.porsche.com/usa/accessoriesandservice/porschefinancialservices/pfs-leasing-offers";
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow" as RequestRedirect,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    console.error("Failed to fetch Porsche offers:", response.status);
    return [];
  }

  const html = await response.text();
  const offers: any[] = [];

  // Extract all lease offer containers - find opening tag and match to closing tag
  const offerContainerMatches: Array<{ start: number; end: number; content: string }> = [];
  const containerStartRegex = /<div[^>]*class="[^"]*leasing-offer-container[^"]*"[^>]*>/gi;
  let match;

  while ((match = containerStartRegex.exec(html)) !== null) {
    const startIndex = match.index;
    const startTagEnd = match.index + match[0].length;
    let depth = 1;
    let pos = startTagEnd;

    while (pos < html.length && depth > 0) {
      const remaining = html.substring(pos);
      const closeMatch = remaining.match(/<\/div>/i);
      const openMatch = remaining.match(/<div[^>]*>/i);

      if (closeMatch && (!openMatch || closeMatch.index! < openMatch.index!)) {
        depth--;
        if (depth === 0) {
          offerContainerMatches.push({
            start: startIndex,
            end: pos + closeMatch.index! + closeMatch[0].length,
            content: html.substring(startTagEnd, pos + closeMatch.index!),
          });
          break;
        }
        pos += closeMatch.index! + closeMatch[0].length;
      } else if (openMatch) {
        depth++;
        pos += openMatch.index! + openMatch[0].length;
      } else {
        break;
      }
    }
  }

  for (const containerMatch of offerContainerMatches) {
    const offerHtml = containerMatch.content;

    // Extract headline (model and year)
    const headlineMatch = offerHtml.match(
      /<h3[^>]*class="[^"]*offer-headline[^"]*"[^>]*>([^<]+)<\/h3>/i,
    );
    if (!headlineMatch) continue;

    const headline = extractTextFromHTML(headlineMatch[1]);
    const { year, model } = parseModelYear(headline);

    // Extract monthly payment - handle newlines and whitespace
    const monthlyPaymentMatch = offerHtml.match(
      /<b[^>]*>Monthly Payment:<\/b>[\s\S]*?<div[^>]*class="[^"]*payment-numbers[^"]*"[^>]*>([^<]+)<\/div>/i,
    );
    const leaseMonthlyPayment = monthlyPaymentMatch ? extractNumber(monthlyPaymentMatch[1]) : null;

    // Extract term in months - handle newlines and whitespace
    const termMatch = offerHtml.match(
      /<b[^>]*>Term in months:<\/b>[\s\S]*?<div[^>]*class="[^"]*payment-numbers[^"]*"[^>]*>([^<]+)<\/div>/i,
    );
    const leaseTermMonths = termMatch ? parseInt(termMatch[1].trim(), 10) : null;

    // Extract due at signing - handle multiple classes
    const dueAtSigningMatch = offerHtml.match(
      /<div[^>]*class="[^"]*downPayment[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    );
    const leaseDueAtSigning = dueAtSigningMatch
      ? extractDueAtSigning(extractTextFromHTML(dueAtSigningMatch[1]))
      : null;

    // Extract short disclaimer - handle multiple classes and multiline content
    const shortDisclaimerMatch = offerHtml.match(
      /<div[^>]*class="[^"]*ShortDisclaimer[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    );
    const shortDisclaimer = shortDisclaimerMatch
      ? extractTextFromHTML(shortDisclaimerMatch[1])
      : null;

    // Find corresponding terms and conditions in the disclaimer section
    // The terms are linked via anchor tags like <a href="#terms1">
    const termsLinkMatch = offerHtml.match(/<a[^>]*href="#terms(\d+)"[^>]*>/i);
    let finePrint = null;
    let expirationDate = null;

    if (termsLinkMatch) {
      const termsId = termsLinkMatch[1];
      // Find the corresponding disclaimer section by ID
      const disclaimerSectionRegex = new RegExp(
        `<div[^>]*class="[^"]*offer-disclaimer[^"]*"[^>]*id="terms${termsId}"[^>]*>([\\s\\S]*?)<\\/div>\\s*<div[^>]*class="[^"]*disclaimer-tandc[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`,
        "i",
      );
      const disclaimerMatch = html.match(disclaimerSectionRegex);

      if (disclaimerMatch) {
        // Extract model name from the offer-disclaimer section (e.g., "<sup>1</sup>2025 Macan Electric")
        const offerDisclaimerHtml = disclaimerMatch[1];
        const modelNameInTermsMatch = offerDisclaimerHtml.match(/<sup>\d+<\/sup>([^<]+)/i);

        if (modelNameInTermsMatch) {
          const modelNameInTerms = extractTextFromHTML(modelNameInTermsMatch[1]).trim();
          const { model: modelInTerms } = parseModelYear(modelNameInTerms);

          // Normalize model names for comparison (remove extra spaces, case insensitive)
          const normalizedOfferModel = model.toLowerCase().replace(/\s+/g, " ").trim();
          const normalizedTermsModel = modelInTerms.toLowerCase().replace(/\s+/g, " ").trim();

          // Match the model name in terms with the offer model
          if (
            normalizedOfferModel === normalizedTermsModel ||
            modelInTerms.includes(model) ||
            model.includes(modelInTerms)
          ) {
            finePrint = extractTextFromHTML(disclaimerMatch[2]);
            expirationDate = extractExpirationDate(finePrint);
          } else {
            console.warn(`Model name mismatch: offer="${model}" vs terms="${modelInTerms}"`);
          }
        } else {
          // If we can't find model name in terms, still extract the terms text
          finePrint = extractTextFromHTML(disclaimerMatch[2]);
          expirationDate = extractExpirationDate(finePrint);
        }
      }
    }

    // Extract miles per year from finePrint if available
    let milesPerYear = null;
    if (finePrint) {
      milesPerYear = extractMilesPerYear(finePrint);
    }

    // Extract description if available
    const descriptionMatch = offerHtml.match(
      /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    );
    const description = descriptionMatch ? extractTextFromHTML(descriptionMatch[1]) : null;

    offers.push({
      brand: "Porsche",
      year: year,
      make: "Porsche",
      model: model,
      modelCode: null,
      trim: null,
      offerType: "lease",
      offerAmount: null,
      aprRate: null,
      aprTermMonths: null,
      leaseTermMonths: leaseTermMonths,
      cashValue: null,
      leaseDueAtSigning: leaseDueAtSigning,
      leaseMonthlyPayment: leaseMonthlyPayment,
      milesPerYear: milesPerYear,
      terms: shortDisclaimer,
      finePrint: finePrint,
      expirationDate: expirationDate,
    });
  }

  return offers;
};

export async function scrapeOffersFromPorsche() {
  try {
    await prisma.$connect();
    const offers = await fetchOfferData();

    if (offers.length === 0) {
      console.warn("No Porsche offers found");
      return { success: false, error: "No offers found" };
    }

    console.log(`Fetched ${offers.length} Porsche offers`);

    // Delete existing Porsche offers
    await prisma.offers.deleteMany({
      where: {
        brand: "Porsche",
      },
    });
    console.log("Deleted all existing Porsche offers");

    // Insert new offers in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < offers.length; i += BATCH_SIZE) {
      const batch = offers.slice(i, i + BATCH_SIZE);
      try {
        await prisma.$transaction(async (tx) => {
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
              expirationDate: offer.expirationDate ? new Date(offer.expirationDate) : null,
              scrapedAt: new Date(),
            })),
            skipDuplicates: true,
          });
        });
      } catch (err: any) {
        console.error("Error storing Porsche offer batch:", err?.message || err);
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (err: any) {
    console.error("Error scraping Porsche offers:", err?.message || err);
    return { success: false, error: err?.message || err };
  } finally {
    await prisma.$disconnect();
  }
}
