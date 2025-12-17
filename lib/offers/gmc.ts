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

// Extract trade discount from text (e.g., "$11,799 Total Value when you trade in")
function extractTradeDiscount(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    // Look for patterns like "$X,XXX Total Value" especially when associated with trade-in
    const match = text.match(/\$([\d,]+)\s+total\s+value/i);
    if (match && match[1]) {
      // Check if it mentions trade-in to confirm it's a trade discount
      const tradeInContext = text.match(/trade\s+in|trade-in/i);
      if (tradeInContext) {
        return parseNumber(match[1]);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Simple helper to strip HTML and decode entities into plain text
function stripHtmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  try {
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " "); // remove all tags

    // Decode common HTML entities
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      .replace(/&apos;/g, "'");

    text = text.replace(/\s+/g, " ").trim();
    return text || null;
  } catch {
    return null;
  }
}

// Extract text content from HTML used for full featured-offer fragments
// (kept separate from stripHtmlToText so we can preserve section structure)
function extractTextFromHTML(html: string | null | undefined): string {
  if (!html) return "";
  try {
    // If it's a full HTML document, extract body content
    let contentHtml = html;
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      contentHtml = bodyMatch[1];
    }
    
    // Extract only the relevant adv-col section that contains offer content
    // Look for adv-col with q-cc-ag-black-bg class that contains offer text (not buttons)
    const advColMatches = contentHtml.matchAll(/<adv-col[^>]*class="[^"]*q-cc-ag-black-bg[^"]*"[^>]*>([\s\S]*?)<\/adv-col>/gi);
    let offerSectionHtml = "";
    
    for (const match of advColMatches) {
      const sectionContent = match[1];
      // Check if this section contains offer content (has h1, p with text, not just buttons)
      // Look for any offer-related content
      if (sectionContent.includes("<h1") && 
          (sectionContent.includes("APR") || 
           sectionContent.includes("Total Value") || 
           sectionContent.includes("AVERAGE FINANCE SAVINGS") ||
           sectionContent.includes("PURCHASE ALLOWANCE") ||
           sectionContent.includes("Purchase Allowance") ||
           sectionContent.includes("cash back") ||
           sectionContent.includes("BONUS CASH") ||
           sectionContent.includes("<p"))) {
        offerSectionHtml = sectionContent;
        break; // Use the first matching section
      }
    }
    
    // If no specific section found but we have adv-col with q-cc-ag-black-bg, use the first one
    if (!offerSectionHtml) {
      const firstAdvColMatch = contentHtml.match(/<adv-col[^>]*class="[^"]*q-cc-ag-black-bg[^"]*"[^>]*>([\s\S]*?)<\/adv-col>/i);
      if (firstAdvColMatch && firstAdvColMatch[1]) {
        offerSectionHtml = firstAdvColMatch[1];
      } else {
        // Fallback to entire content
        offerSectionHtml = contentHtml;
      }
    }
    
    // Remove elements that don't contain useful text content
    let processedHtml = offerSectionHtml
      .replace(/<a[^>]*>[\s\S]*?<\/a>/gi, "") // Remove anchor tags and their content
      .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, "") // Remove button tags and their content
      .replace(/<gb-disclosure[^>]*>[\s\S]*?<\/gb-disclosure>/gi, "") // Remove gb-disclosure tags and their content
      .replace(/<gb-disclosure[^>]*\/>/gi, "") // Remove self-closing gb-disclosure tags
      .replace(/<picture[^>]*>[\s\S]*?<\/picture>/gi, "") // Remove picture tags and their content
      .replace(/<img[^>]*>/gi, "") // Remove img tags
      .replace(/<source[^>]*>/gi, "") // Remove source tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove script tags
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ""); // Remove style tags
    
    // Replace closing tags with newlines to preserve section breaks
    // Prioritize divs with "medium-margin" class to create clear section breaks
    processedHtml = processedHtml.replace(/<\/div[^>]*class="[^"]*medium-margin[^"]*"[^>]*>/gi, "\n\n");
    processedHtml = processedHtml.replace(/<\/(div|p|h[1-6]|section|article|header|footer|li|br|adv-col|adv-grid|hr)[^>]*>/gi, "\n");
    
    // Replace opening tags with newlines
    processedHtml = processedHtml.replace(/<div[^>]*class="[^"]*medium-margin[^"]*"[^>]*>/gi, "\n");
    processedHtml = processedHtml.replace(/<(div|p|h[1-6]|section|article|header|footer|li|br|adv-col|adv-grid|hr)[^>]*>/gi, "\n");
    
    // Remove all remaining HTML tags (span, b, sup, etc.) but preserve text content
    let text = processedHtml.replace(/<[^>]*>/g, " ");
    
    // Decode HTML entities (important for &nbsp; and &amp;)
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      .replace(/&apos;/g, "'");
    
    // Remove common button/link text patterns
    text = text
      .replace(/\b(INVENTORY|REQUEST DEALER PRICING|BUILD & BUY|BUILD &amp; BUY)\b/gi, "")
      .replace(/\b(move-text)\b/gi, "")
      .replace(/\bFEATURED OFFER\b/gi, ""); // Remove "FEATURED OFFER" label
    
    // Remove standalone asterisks and disclosure markers
    text = text
      .replace(/\s*\*\s*/g, " ") // Remove asterisks used for disclosures
      .replace(/\s*\(\s*\)\s*/g, " "); // Remove empty parentheses
    
    // Normalize whitespace but preserve newlines between sections
    text = text
      .replace(/[ \t]+/g, " ") // Replace multiple spaces/tabs with single space
      .replace(/\n\s+/g, "\n") // Remove leading spaces after newlines
      .replace(/\s+\n/g, "\n") // Remove trailing spaces before newlines
      .replace(/\n{3,}/g, "\n\n") // Replace 3+ newlines with double newline
      .trim();
    
    return text;
  } catch (error) {
    console.error("Error extracting text from HTML:", error);
    return "";
  }
}

// Fetch and parse featured offer HTML
async function fetchFeaturedOfferHTML(featuredOfferUrl: string): Promise<string | null> {
  try {
    // Construct full URL - featuredOfferUrl is relative, prepend base URL
    const baseUrl = "https://gmc.com";
    const fullUrl = featuredOfferUrl.startsWith("/")
      ? `${baseUrl}${featuredOfferUrl}`
      : `${baseUrl}/${featuredOfferUrl}`;

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      redirect: "follow" as RequestRedirect,
    });

    if (!response.ok) {
      console.warn(`Failed to fetch featured offer HTML from ${fullUrl}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    return html;
  } catch (error: any) {
    console.warn(`Error fetching featured offer HTML from ${featuredOfferUrl}:`, error?.message || error);
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
      // Extract basic vehicle information
      const brand = "GMC";
      const year = result.modelYear ? parseInt(result.modelYear, 10) : null;
      const model = result.displayName || result.carline || null;
      const carline = result.carline || null;
      const bodystyle = result.bodystyle || null;
      const trims = result.trims && Array.isArray(result.trims) ? result.trims : [];
      const trim = trims.length > 0 ? trims.join(", ") : null;

      // Handle Featured Offers separately
      if (result.offerType === "Featured Offer" && result.featuredOfferUrl) {
        try {
          // Fetch HTML from featured offer URL
          const html = await fetchFeaturedOfferHTML(result.featuredOfferUrl);
          if (!html) {
            console.warn(`Failed to fetch HTML for featured offer: ${model} ${year}`);
            continue;
          }

          // Extract text from HTML
          const htmlText = extractTextFromHTML(html);

          // Extract APR from HTML text
          const apr = extractAPR(htmlText);

          // Determine offer type: if APR found, it's financing, otherwise cash/credit
          const offerType = apr !== null ? "financing" : "cash";

          // Extract other details from HTML text
          const monthlyPayment = extractMonthlyPayment(htmlText);
          const termMonths = extractTermMonths(htmlText);
          const dueAtSigning = extractDueAtSigning(htmlText);
          
          // Extract cashBack from HTML text (regardless of offer type)
          let cashBack: number | null = null;
          // Look for "PURCHASE ALLOWANCE" pattern first (this is cashback)
          const purchaseAllowanceMatch = htmlText.match(/\$([\d,]+)\s+PURCHASE\s+ALLOWANCE\.?/i);
          if (purchaseAllowanceMatch && purchaseAllowanceMatch[1]) {
            cashBack = parseNumber(purchaseAllowanceMatch[1]);
          } else {
            // Look for other patterns like "$X,XXX cash back", "$X,XXX off", "$X,XXX discount", or "$X,XXX bonus cash"
            const cashBackMatch = htmlText.match(/\$([\d,]+)\s+(?:cash\s+back|off|discount|bonus\s+cash)/i);
            if (cashBackMatch && cashBackMatch[1]) {
              cashBack = parseNumber(cashBackMatch[1]);
            }
          }
          // Note: "Average Finance Savings" is NOT cashback, it's a separate savings calculation

          // Extract trade discount from HTML text (separate from cashBack)
          const tradeDiscount = extractTradeDiscount(htmlText);

          // Extract expiration date if available
          const expirationDate = parseExpirationDate(result.endEffDate);

          // Build terms and fine print from HTML text
          // Remove "featured offer" text (case insensitive) and normalize
          let terms = htmlText.trim() || null;
          if (terms) {
            // Remove "featured offer" text
            terms = terms.replace(/featured\s+offer/gi, "").trim();
            // Clean up whitespace but preserve section structure
            // Replace 3+ newlines with double newline (section breaks)
            terms = terms.replace(/\n{3,}/g, "\n\n");
            // Remove leading/trailing newlines from each line
            terms = terms.split("\n").map(line => line.trim()).join("\n");
            // Ensure proper spacing: single newline between lines, double newline between sections
            terms = terms.replace(/\n\n+/g, "\n\n").trim();
            terms = terms || null;
          }
          const finePrint = null; // Featured offers may not have separate fine print

          // Only create offer if we have meaningful data
          // Accept offers if we have any of: APR, cashback, trade discount, or meaningful text content
          const hasValidData =
            apr !== null ||
            cashBack !== null ||
            tradeDiscount !== null ||
            (htmlText.trim().length > 30); // At least 30 characters of text content

          if (!hasValidData) {
            console.log(htmlText)
            console.warn(`Skipping featured ${offerType} offer for ${model} ${year} - insufficient data`);
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
            offerAmount: null,
            apr,
            termMonths,
            cashBack,
            tradeDiscount,
            dueAtSigning,
            monthlyPayment,
            milesPerYear: null,
            expirationDate,
            terms,
            finePrint,
            scrapedAt,
          });

          continue; // Move to next result
        } catch (error: any) {
          console.warn(`Error processing featured offer for ${model} ${year}:`, error?.message || error);
          continue;
        }
      }

      // Skip if it's a Featured Offer without a URL
      if (result.offerType === "Featured Offer") {
        continue;
      }

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

      // Build terms text from body (remove leading and trailing spaces)
      const terms = bodyText ? bodyText.trim() : null;

      // Build fine print from footer - strip HTML and keep only plain text
      const finePrint = stripHtmlToText(footerText);

      // Don't populate offerAmount from monthlyPayment or cashBack - keep them separate
      // offerAmount should only be set if explicitly extracted from the offer content
      let offerAmount: number | null = null;
      
      // Extract cashBack from body text (regardless of offer type)
      let cashBack: number | null = null;
      // Look for "PURCHASE ALLOWANCE" pattern first (this is cashback)
      // Pattern handles: "$2,000 PURCHASE ALLOWANCE" or "$2,000 PURCHASE ALLOWANCE."
      const purchaseAllowanceMatch = bodyText.match(/\$([\d,]+)\s+PURCHASE\s+ALLOWANCE\.?/i);
      if (purchaseAllowanceMatch && purchaseAllowanceMatch[1]) {
        cashBack = parseNumber(purchaseAllowanceMatch[1]);
      } else {
        // Look for other patterns like "$X,XXX cash back", "$X,XXX off", "$X,XXX discount", or "$X,XXX bonus cash"
        const cashBackMatch = bodyText.match(/\$([\d,]+)\s+(?:cash\s+back|off|discount|bonus\s+cash)/i);
        if (cashBackMatch && cashBackMatch[1]) {
          cashBack = parseNumber(cashBackMatch[1]);
        }
      }
      // Note: "Average Finance Savings" is NOT cashback, it's a separate savings calculation

      // Extract trade discount from body text (separate from cashBack)
      const tradeDiscount = extractTradeDiscount(bodyText) || extractTradeDiscount(footerText);

      // Only create offer if we have meaningful data
      const hasValidData =
        (offerType === "lease" && monthlyPayment) ||
        (offerType === "financing" && apr !== null) ||
        (offerType === "cash" && (offerAmount !== null || cashBack !== null || tradeDiscount !== null));

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
        tradeDiscount,
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
                  tradeDiscount: offer.tradeDiscount,
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

