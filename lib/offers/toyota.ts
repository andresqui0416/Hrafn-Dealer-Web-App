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

// Extract text content from HTML
function extractTextFromHTML(html: string | null | undefined): string {
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
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract monthly payment from text (e.g., "$299/month", "$299 per month")
function extractMonthlyPayment(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/\$([\d,]+)\s*(?:per\s+month|\/month|\/mo)/i);
    if (match && match[1]) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract APR from text (e.g., "0.9% APR", "APR 0.9%")
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

// Extract term months from text (e.g., "for 36 months", "36 months", "36-mos")
function extractTermMonths(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/(?:for\s+)?(\d+)[-\s]*(?:months?|mos?)/i);
    if (match && match[1]) {
      const term = parseInt(match[1], 10);
      if (!isNaN(term) && term > 0) return term;
    }
    return null;
  } catch {
    return null;
  }
}

// Extract cash back from text (e.g., "$2,500 cash back", "$2,500 Customer Cash")
function extractCashBack(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const patterns = [
      /\$([\d,]+)\s+(?:cash\s+back|customer\s+cash|bonus\s+cash|cash)/i,
      /\$([\d,]+)\s+off/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseNumber(match[1]);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Extract expiration date from text
function extractExpirationDate(text: string | null | undefined): Date | null {
  if (!text) return null;
  try {
    // Patterns: "Take delivery by 1/02/2026", "Expires 1/2/26", "Valid until 1-2-2026"
    const patterns = [
      /(?:take\s+delivery|expires|valid\s+until|must\s+take\s+delivery)\s+by?\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let month = parseInt(match[1], 10);
        let day = parseInt(match[2], 10);
        let year = parseInt(match[3], 10);

        if (year < 100) {
          year = 2000 + year;
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2030) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Extract JSON object from a string by finding matching braces
function extractJSONObject(str: string, startIndex: number): string | null {
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let startPos = -1;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      if (startPos === -1) startPos = i;
      braceCount++;
    } else if (char === "}") {
      braceCount--;
      if (braceCount === 0 && startPos !== -1) {
        return str.substring(startPos, i + 1);
      }
    }
  }

  return null;
}

// Try to extract JSON data from script tags
function extractJSONFromScript(html: string): any {
  try {
    // Look for window.__SSR_STATE__ first (Toyota specific)
    const ssrStateIndex = html.indexOf("window.__SSR_STATE__");
    if (ssrStateIndex !== -1) {
      // Find the equals sign after __SSR_STATE__
      const equalsIndex = html.indexOf("=", ssrStateIndex);
      if (equalsIndex !== -1) {
        // Find the closing script tag after the assignment
        const scriptEndIndex = html.indexOf("</script>", equalsIndex);
        if (scriptEndIndex !== -1) {
          // Extract everything between = and </script>
          const jsonStr = html.substring(equalsIndex + 1, scriptEndIndex).trim();

          // Remove trailing semicolon if present
          const cleanedJsonStr = jsonStr.replace(/;\s*$/, "").trim();

          if (cleanedJsonStr) {
            try {
              // Replace undefined values with null to make valid JSON
              // JavaScript allows undefined in object literals, but JSON does not
              let cleanedJson = cleanedJsonStr;

              // Replace :undefined, :undefined} with :null, :null}
              cleanedJson = cleanedJson.replace(/:\s*undefined\s*([,}\]])/g, ": null$1");
              // Handle trailing undefined at end of lines
              cleanedJson = cleanedJson.replace(/:\s*undefined\s*$/gm, ": null");
              // Remove standalone undefined in arrays: ,undefined, or ,undefined}
              cleanedJson = cleanedJson.replace(/,\s*undefined\s*([,}\]])/g, "$1");
              cleanedJson = cleanedJson.replace(/,\s*undefined\s*$/gm, "");

              return JSON.parse(cleanedJson);
            } catch (parseError: any) {
              console.warn(
                "Failed to parse __SSR_STATE__ JSON:",
                parseError?.message || parseError,
              );
            }
          }
        }
      }
    }

    // Look for __NEXT_DATA__ or similar
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch && nextDataMatch[1]) {
      return JSON.parse(nextDataMatch[1]);
    }

    // Look for window.__INITIAL_STATE__ or similar
    const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/i);
    if (initialStateMatch && initialStateMatch[1]) {
      return JSON.parse(initialStateMatch[1]);
    }

    // Look for any script tag with type="application/json"
    const jsonScriptMatch = html.match(
      /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i,
    );
    if (jsonScriptMatch && jsonScriptMatch[1]) {
      return JSON.parse(jsonScriptMatch[1]);
    }

    return null;
  } catch {
    return null;
  }
}

export async function scrapeOffersFromToyota() {
  try {
    const response = await fetch("https://www.toyota.com/norcal/deals-incentives/", {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow" as RequestRedirect,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Toyota API error:", response.status, text.substring(0, 500));
      throw new Error(`Toyota API request failed: ${response.status}`);
    }

    const html = await response.text();

    // Try to extract JSON data from script tags first
    const jsonData = extractJSONFromScript(html);
    let offers: any[] = [];

    if (jsonData) {
      // Navigate through the JSON structure to find featuredVehicles
      // Structure: window.__SSR_STATE__ = { components: [...] }
      // components[1] = layout component
      // components[1].placeholders.content[0] = errorBoundary
      // errorBoundary.placeholders.content[1] = content with modules (second item in content array)
      try {
        // Check if jsonData has components array (window.__SSR_STATE__ structure)
        const components = jsonData.components;
        if (Array.isArray(components) && components.length > 1) {
          const layoutComponent = components[1];
          const errorBoundary = layoutComponent?.placeholders?.content?.[0];
          // The modules are in the second content item (index 1), not the first
          const contentWithModules = errorBoundary?.placeholders?.content?.[1];
          const modules = contentWithModules?.fields?.modules;

          if (Array.isArray(modules)) {
            for (const moduleItem of modules) {
              if (
                moduleItem?.type === "featuredVehicles" &&
                Array.isArray(moduleItem.featuredVehicles)
              ) {
                for (const featuredVehicle of moduleItem.featuredVehicles) {
                  if (Array.isArray(featuredVehicle.offers)) {
                    offers.push(...featuredVehicle.offers);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn("Error extracting offers from JSON structure:", error);
      }

      // Also try to find offers recursively in the JSON structure
      if (offers.length === 0) {
        function findOffersRecursive(obj: any, depth: number = 0): any[] {
          if (depth > 10) return []; // Prevent infinite recursion
          if (!obj || typeof obj !== "object") return [];

          const found: any[] = [];

          // Check if this object has an 'offers' array
          if (Array.isArray(obj.offers)) {
            found.push(...obj.offers);
          }

          // Recursively search in nested objects
          for (const key in obj) {
            if (obj.hasOwnProperty(key) && typeof obj[key] === "object") {
              found.push(...findOffersRecursive(obj[key], depth + 1));
            }
          }

          return found;
        }

        const recursiveOffers = findOffersRecursive(jsonData);
        if (recursiveOffers.length > 0) {
          offers = recursiveOffers;
        }
      }
    }

    if (offers.length === 0) {
      console.warn("No offers found in Toyota response");
      return { success: false, error: "No offers found in response" };
    }

    const processedOffers: any[] = [];
    const scrapedAt = new Date();

    // Process each offer
    for (const offer of offers) {
      // Skip misc and multiVehicle offers (these are general programs, not specific vehicle offers)
      if (offer.type === "misc" || offer.type === "multiVehicle") {
        continue;
      }

      // Extract model information from series array
      const series =
        Array.isArray(offer.series) && offer.series.length > 0 ? offer.series[0] : null;
      const modelName =
        series && Array.isArray(series.name) && series.name.length > 0
          ? series.name[0]
          : offer.seriesOrCardTitle || offer.offerTitle || null;
      const modelCode =
        series && series.id && Array.isArray(series.id) && series.id.length > 0
          ? series.id[0]
          : null;
      const year = series?.year ? parseInt(String(series.year), 10) : null;
      const trim = offer.includedTrim || null;

      // Determine offer type from primaryLabel field
      let offerType = "cash";
      const primaryLabel = (offer.primaryLabel || "").toLowerCase();
      if (primaryLabel === "lease") {
        offerType = "lease";
      } else if (primaryLabel === "apr") {
        offerType = "financing";
      } else if (primaryLabel === "cash") {
        offerType = "cash";
      } else {
        // Fallback to type field if primaryLabel is not available
        if (offer.type === "lease") {
          offerType = "lease";
        } else if (offer.type === "apr") {
          offerType = "financing";
        }
      }

      // Extract offer details based on type
      let aprRate: number | null = null;
      let aprTermMonths: number | null = null;
      let leaseTermMonths: number | null = null;
      let leaseMonthlyPayment: number | null = null;
      let leaseDueAtSigning: number | null = null;
      let cashValue: number | null = null;
      let milesPerYear: number | null = null;

      if (offerType === "financing" && offer.apr) {
        // APR offers: apr.rate is the APR percentage, apr.duration is term in months
        const aprData = offer.apr as any;
        if (aprData && aprData.rate) {
          const rate = parseNumber(aprData.rate);
          if (rate !== null) {
            aprRate = rate / 100;
          }
        }
        if (aprData && aprData.duration) {
          aprTermMonths = parseInt(String(aprData.duration), 10);
        }
      } else if (offerType === "lease" && offer.lease) {
        // Lease offers: lease.monthlyPayment, lease.dueAtSigning, lease.duration
        const leaseData = offer.lease as any;
        if (leaseData?.monthlyPayment) {
          leaseMonthlyPayment = parseNumber(leaseData.monthlyPayment);
        }
        if (leaseData?.dueAtSigning) {
          leaseDueAtSigning = parseNumber(leaseData.dueAtSigning);
        }
        if (leaseData?.duration) {
          leaseTermMonths = parseInt(String(leaseData.duration), 10);
        }
      } else if (offerType === "cash") {
        // Cash offers: can be in cash.cashAmount or multiVehicle.cashAmount
        if (offer.cash) {
          const cashData = offer.cash as any;
          if (cashData?.cashAmount) {
            cashValue = parseNumber(cashData.cashAmount);
          }
        } else if (offer.multiVehicle) {
          const multiVehicleData = offer.multiVehicle as any;
          if (multiVehicleData?.cashAmount) {
            cashValue = parseNumber(multiVehicleData.cashAmount);
          }
        }
      }

      // Extract expiration date from endDate object
      let expirationDate: Date | null = null;
      if (offer.endDate) {
        const endDate = offer.endDate;
        if (endDate.fullYear && endDate.month && endDate.day) {
          const year = parseInt(String(endDate.fullYear), 10);
          const month = parseInt(String(endDate.month), 10) - 1; // Month is 0-indexed
          const day = parseInt(String(endDate.day), 10);
          expirationDate = new Date(year, month, day);
          if (isNaN(expirationDate.getTime())) {
            expirationDate = null;
          }
        }
      }

      // Extract terms and fine print
      const terms = offer.description || offer.offerTitle || null;
      const finePrint =
        Array.isArray(offer.disclaimers) && offer.disclaimers.length > 0
          ? offer.disclaimers.join("\n\n")
          : null;

      // Only create offer if we have meaningful data
      const hasValidData =
        (offerType === "lease" && leaseMonthlyPayment !== null) ||
        (offerType === "financing" && aprRate !== null) ||
        (offerType === "cash" && (cashValue !== null || terms !== null));

      if (!hasValidData) {
        console.warn(`Skipping ${offerType} offer for ${modelName} ${year} - insufficient data`);
        continue;
      }

      processedOffers.push({
        brand: "Toyota",
        year: year ? parseInt(String(year), 10) : null,
        make: "Toyota",
        model: modelName,
        modelCode: modelCode,
        trim: trim,
        offerType: offerType,
        offerAmount: null,
        aprRate: aprRate,
        aprTermMonths: aprTermMonths,
        leaseTermMonths: leaseTermMonths,
        cashValue: cashValue,
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

    console.log("Toyota offers found:", processedOffers.length);

    // Delete all existing Toyota offers first
    await prisma.offers.deleteMany({
      where: {
        brand: "Toyota",
      },
    });
    console.log("Deleted all existing Toyota offers");

    // Store offers in database - process in batches to avoid transaction timeout
    if (processedOffers.length > 0) {
      const BATCH_SIZE = 10; // Process 10 offers at a time
      for (let i = 0; i < processedOffers.length; i += BATCH_SIZE) {
        const batch = processedOffers.slice(i, i + BATCH_SIZE);
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
          console.error("Error storing Toyota offer batch:", err?.message || err);
        }
      }
    }

    return { success: true, totalOffers: processedOffers.length };
  } catch (error: any) {
    console.error("Error scraping Toyota offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Toyota offers",
    };
  }
}
