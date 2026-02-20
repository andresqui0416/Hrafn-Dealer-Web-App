import {
  createScrapeEvent,
  markScrapeEventFailed,
  storeScrapedIncentives,
  type NormalizedIncentiveOffer,
} from "@/lib/incentives/storeScrapedIncentives";

const LucidSourceUrl = "https://lucidmotors.com/offers";

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

// Extract expiration date from text (e.g., "Must take delivery by December 31, 2025")
function extractExpirationDateFromText(text: string | null | undefined): Date | null {
  if (!text) return null;
  try {
    const patterns = [
      /by\s+(\w+)\s+(\d+),\s+(\d{4})/i,
      /through\s+(\w+)\s+(\d+),\s+(\d{4})/i,
      /until\s+(\w+)\s+(\d+),\s+(\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const monthNames = [
          "january",
          "february",
          "march",
          "april",
          "may",
          "june",
          "july",
          "august",
          "september",
          "october",
          "november",
          "december",
        ];
        const monthName = match[1].toLowerCase();
        const month = monthNames.indexOf(monthName);
        if (month !== -1) {
          const day = parseInt(match[2], 10);
          const year = parseInt(match[3], 10);
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) return date;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Extract term months from text (e.g., "for 36 months" or "for up to 72 months")
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

// Extract due at signing amount from text (e.g., "With $4,749 due at signing")
function extractDueAtSigning(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/\$([\d,]+)\s+due\s+at\s+signing/i);
    if (match) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract dollar amount near a keyword (e.g. "$500 military" or "loyalty bonus $500") for schema bonus/discount fields
function extractAmountNearKeyword(text: string | null | undefined, keyword: RegExp): number | null {
  if (!text) return null;
  try {
    const afterKeyword = new RegExp(`${keyword.source}[\\s\\S]{0,80}?\\$([\\d,]+)`, "i");
    let match = text.match(afterKeyword);
    if (match && match[1]) return parseNumber(match[1]);
    const beforeKeyword = new RegExp(`\\$([\\d,]+)[\\s\\S]{0,80}?${keyword.source}`, "i");
    match = text.match(beforeKeyword);
    if (match && match[1]) return parseNumber(match[1]);
    return null;
  } catch {
    return null;
  }
}

export async function scrapeOffersFromLucid() {
  const { scrapeEventId } = await createScrapeEvent({
    brand: "Lucid",
    source: "lucid",
  });
  try {
    const lucidOffersUrl = "https://lucidmotors.com/offers";
    const response = await fetch(lucidOffersUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Lucid API error:", response.status, text.substring(0, 500));
      throw new Error(`Lucid API request failed: ${response.status}`);
    }

    const html = await response.text();

    // Find all offer cards - support both legacy (OffersCard_offersCard) and current (TrimCard_offersContainer) DOM
    const offerCards: string[] = [];

    const hasOffersCard = html.includes("OffersCard_offersCard");
    const hasTrimCard = html.includes("TrimCard_offersContainer");
    const hasDynamicCardList = html.includes("DynamicCardList_container");

    if (!hasOffersCard && !hasTrimCard && !hasDynamicCardList) {
      const alternativePatterns = [
        /OffersCard[^"'\s]*/gi,
        /offersCard/gi,
        /offer-card/gi,
        /TrimCard[^"'\s]*/gi,
        /DynamicCardList[^"'\s]*/gi,
        /Spec_specContainer/gi,
      ];
      const foundAlternative = alternativePatterns.some((p) => p.test(html));
      if (!foundAlternative) {
        console.error("No offer card class found in HTML");
        return { success: false, error: "No offer card class found in HTML" };
      }
    }

    // Prefer new structure (TrimCard), fall back to legacy (OffersCard)
    const classPattern = hasTrimCard || hasDynamicCardList
      ? /TrimCard_offersContainer__\w+/g
      : /OffersCard_offersCard__\w+/g;
    const classMatches = Array.from(html.matchAll(classPattern));

    for (const classMatch of classMatches) {
      const classIndex = classMatch.index || 0;

      // Find the opening <div> tag before this class
      let divStart = html.lastIndexOf("<div", classIndex);
      if (divStart === -1) continue;

      // Find the matching closing </div> by counting depth
      let depth = 0;
      let pos = divStart;
      let inString = false;
      let stringChar = "";

      while (pos < html.length) {
        const char = html[pos];

        // Handle strings (to avoid matching <div> inside attributes)
        if ((char === '"' || char === "'") && html[pos - 1] !== "\\") {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = "";
          }
        }

        if (!inString) {
          if (html.substring(pos, pos + 4) === "<div") {
            depth++;
          } else if (html.substring(pos, pos + 6) === "</div>") {
            depth--;
            if (depth === 0) {
              const divEnd = pos + 6;
              const cardHtml = html.substring(divStart, divEnd);
              offerCards.push(cardHtml);
              break;
            }
          }
        }
        pos++;
      }
    }

    // Remove duplicates (cards that are substrings of other cards)
    const uniqueCards = offerCards.filter((card, index) => {
      return !offerCards.some(
        (otherCard, otherIndex) => otherIndex !== index && otherCard.includes(card),
      );
    });

    if (uniqueCards.length === 0) {
      console.error("No offer cards found in HTML");
      // Log more details for debugging
      if (hasOffersCard) {
        const index = html.indexOf("OffersCard_offersCard");
      }
      return { success: false, error: "No offer cards found in HTML" };
    }

    const offerCardsFinal = uniqueCards;

    const offers: any[] = [];
    const scrapedAt = new Date();

    // Process each offer card
    for (const cardHtml of offerCardsFinal) {
      try {
        // Extract year (e.g., "2026") - look for span with Typography_label class
        const yearMatch = cardHtml.match(
          /<span[^>]*class="[^"]*Typography_label[^"]*"[^>]*>(\d{4})<\/span>/i,
        );
        const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

        // Extract model name (e.g., "Lucid Air Pure") - look for h3 with Typography_subtitle class
        const modelMatch = cardHtml.match(
          /<h3[^>]*class="[^"]*Typography_subtitle[^"]*"[^>]*>([^<]+)<\/h3>/i,
        );
        const model = modelMatch ? modelMatch[1].trim() : null;

        if (!model || !year) {
          console.warn("Skipping offer card - missing model or year", { model, year });
          continue;
        }

        // Extract offer containers: new DOM uses Tabs_content (tabpanel), legacy uses OffersCard_paymentType
        const offerContainers: { html: string; offerType: "lease" | "financing" | "cash" }[] = [];
        const isNewDom = /TrimCard_offersContainer|Tabs_content__/.test(cardHtml);

        if (isNewDom) {
          // New structure: find Tabs_content (tabpanel) divs; order = Lease, Finance, Cash
          const tabPanelPattern = /<div[^>]*class="[^"]*Tabs_content__[^"]*"[^>]*(?:id="tabpanel-(\d+)")?[^>]*>/gi;
          const tabOrder: ("lease" | "financing" | "cash")[] = ["lease", "financing", "cash"];
          let tabMatch;
          const panelStarts: { index: number; id: number }[] = [];
          while ((tabMatch = tabPanelPattern.exec(cardHtml)) !== null) {
            const id = tabMatch[1] != null ? parseInt(tabMatch[1], 10) : panelStarts.length;
            panelStarts.push({ index: tabMatch.index, id });
          }
          panelStarts.sort((a, b) => a.index - b.index);
          for (let i = 0; i < panelStarts.length; i++) {
            const start = panelStarts[i].index;
            const divStart = cardHtml.lastIndexOf("<div", start);
            if (divStart === -1) continue;
            let depth = 0;
            let pos = divStart;
            while (pos < cardHtml.length) {
              if (cardHtml.substring(pos, pos + 4) === "<div") depth++;
              else if (cardHtml.substring(pos, pos + 6) === "</div>") {
                depth--;
                if (depth === 0) {
                  const containerHtml = cardHtml.substring(divStart, pos + 6);
                  const offerType = tabOrder[i] ?? "lease";
                  offerContainers.push({ html: containerHtml, offerType });
                  break;
                }
              }
              pos++;
            }
          }
        }

        if (offerContainers.length === 0) {
          // Legacy: Find payment type elements (Lease, Finance, Cash)
          const paymentTypePattern =
            /<p[^>]*class="[^"]*OffersCard_paymentType__[^"]*"[^>]*>([^<]+)<\/p>/gi;
          const paymentTypeMatches = Array.from(cardHtml.matchAll(paymentTypePattern));

          for (let i = 0; i < paymentTypeMatches.length; i++) {
            const paymentMatch = paymentTypeMatches[i];
            const paymentIndex = paymentMatch.index || 0;
            const paymentType = paymentMatch[1].trim();

            let containerStart = cardHtml.lastIndexOf("<div", paymentIndex);
            if (containerStart === -1) continue;

            let containerEnd = -1;
            const nextPaymentIndex =
              i < paymentTypeMatches.length - 1
                ? paymentTypeMatches[i + 1].index || cardHtml.length
                : cardHtml.length;

            let depth = 0;
            let pos = containerStart;
            while (pos < nextPaymentIndex && pos < cardHtml.length) {
              if (cardHtml.substring(pos, pos + 4) === "<div") depth++;
              else if (cardHtml.substring(pos, pos + 6) === "</div>") {
                depth--;
                if (depth === 0) {
                  containerEnd = pos + 6;
                  break;
                }
              }
              pos++;
            }
            if (containerEnd === -1) containerEnd = nextPaymentIndex;
            if (containerEnd > containerStart) {
              const containerHtml = cardHtml.substring(containerStart, containerEnd);
              let offerType: "lease" | "financing" | "cash" = "cash";
              if (paymentType.toLowerCase() === "lease") offerType = "lease";
              else if (paymentType.toLowerCase() === "finance") offerType = "financing";
              else if (paymentType.toLowerCase() === "cash") offerType = "cash";
              offerContainers.push({ html: containerHtml, offerType });
            }
          }
        }

        if (offerContainers.length === 0) {
          console.warn(`No payment types found, trying fallback for ${model} ${year}`);
          const offerContainerRegex =
            /<div[^>]*class="[^"]*OffersCard_offerContainer__[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*OffersCard_offerContainer__|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/gi;
          let containerMatch;
          const order: ("lease" | "financing" | "cash")[] = ["lease", "financing", "cash"];
          let idx = 0;
          while ((containerMatch = offerContainerRegex.exec(cardHtml)) !== null) {
            offerContainers.push({ html: containerMatch[0], offerType: order[idx % 3] ?? "lease" });
            idx++;
          }
        }

        for (const { html: containerHtml, offerType } of offerContainers) {
          // Extract all spec containers within this offer
          // Look for divs with Spec_specContainer class - use a more flexible approach
          const specContainers: string[] = [];

          // Method 1: Try regex pattern
          const specContainerRegex =
            /<div[^>]*class="[^"]*Spec_specContainer__[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*Spec_specContainer__|<\/div>\s*<\/div>\s*<\/div>)/gi;
          let specMatch;
          while ((specMatch = specContainerRegex.exec(containerHtml)) !== null) {
            specContainers.push(specMatch[0]);
          }

          // Method 2: If regex didn't work, find by class name
          if (specContainers.length === 0) {
            const specClassPattern = /Spec_specContainer__\w+/g;
            const specClassMatches = Array.from(containerHtml.matchAll(specClassPattern));

            for (const classMatch of specClassMatches) {
              const classIndex = classMatch.index || 0;
              let divStart = containerHtml.lastIndexOf("<div", classIndex);
              if (divStart === -1) continue;

              // Find matching closing div
              let depth = 0;
              let pos = divStart;
              while (pos < containerHtml.length) {
                if (containerHtml.substring(pos, pos + 4) === "<div") {
                  depth++;
                } else if (containerHtml.substring(pos, pos + 6) === "</div>") {
                  depth--;
                  if (depth === 0) {
                    specContainers.push(containerHtml.substring(divStart, pos + 6));
                    break;
                  }
                }
                pos++;
              }
            }
          }

          let leaseMonthlyPayment: number | null = null;
          let aprRate: number | null = null;
          let aprTermMonths: number | null = null;
          let leaseTermMonths: number | null = null;
          let leaseDueAtSigning: number | null = null;
          let cashValue: number | null = null;
          let offerAmount: number | null = null;
          let terms: string | null = null;

          // Helper function to extract inner text from HTML, removing superscripts but keeping structure
          function extractInnerText(html: string): string {
            return html
              .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "") // Remove superscript disclaimers
              .replace(/<br\s*\/?>/gi, " ") // Replace <br> with space
              .replace(/<[^>]+>/g, "") // Remove all HTML tags
              .replace(/\s+/g, " ") // Normalize whitespace
              .trim();
          }

          // Collect all spec parts for building the combined description
          const specParts: string[] = [];

          for (const specHtml of specContainers) {
            // Extract eyebrow (label) - look for p with Spec_eyebrow class
            const eyebrowMatch = specHtml.match(
              /<p[^>]*class="[^"]*Spec_eyebrow__[^"]*"[^>]*>([^<]+)<\/p>/i,
            );
            const eyebrow = eyebrowMatch ? eyebrowMatch[1].trim() : "";

            // Extract headline (value) - look for h2 with Typography_headline class
            // Handle superscript tags and other nested elements
            let headline = "";
            const headlineMatch = specHtml.match(
              /<h2[^>]*class="[^"]*Typography_headline[^"]*"[^>]*>([\s\S]*?)<\/h2>/i,
            );
            if (headlineMatch && headlineMatch[1]) {
              // Remove superscript disclaimers and other nested tags, keep the main value
              headline = headlineMatch[1]
                .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "") // Remove superscript disclaimers
                .replace(/<[^>]+>/g, "") // Remove any remaining tags
                .trim();
            }

            // Extract description - look for p with Spec_description class
            // Handle nested tags, line breaks, and various HTML structures
            let description = "";
            // Try multiple patterns to find the description
            const descPatterns = [
              /<p[^>]*class="[^"]*Spec_description__[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
              /<p[^>]*class="[^"]*Spec_description[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
            ];

            for (const pattern of descPatterns) {
              const descMatch = specHtml.match(pattern);
              if (descMatch && descMatch[1]) {
                // Extract inner text, keeping structure but removing HTML
                description = extractInnerText(descMatch[1]);
                break; // Use first match
              }
            }

            // Build the combined text for this spec container
            let specText = "";
            if (eyebrow && headline) {
              specText = `${eyebrow} ${headline}`;
            } else if (headline) {
              specText = headline;
            }

            if (description) {
              if (specText) {
                specText = `${specText} ${description}`;
              } else {
                specText = description;
              }
            }

            // Add to spec parts if we have text
            if (specText) {
              specParts.push(specText);
            }

            // Parse based on eyebrow and offer type (use lowercase for comparison)
            const eyebrowLower = eyebrow.toLowerCase();
            if (eyebrowLower === "from" && offerType === "lease") {
              // Monthly payment for lease
              leaseMonthlyPayment = parseNumber(headline);
              leaseTermMonths = extractTermMonths(description) || leaseTermMonths;
              leaseDueAtSigning = extractDueAtSigning(description) || leaseDueAtSigning;
            } else if (eyebrowLower === "apr" && offerType === "financing") {
              // APR for finance
              aprRate = parseNumber(headline);
              aprTermMonths = extractTermMonths(description) || aprTermMonths;
            } else if ((eyebrowLower === "from" || eyebrowLower === "") && offerType === "cash") {
              // Cash price - handle both "from" and empty eyebrow (might be the main price)
              const price = parseNumber(headline);
              if (price && !offerAmount) {
                offerAmount = price;
              }
              // Check description for credits (e.g., "Plus $12,500 Air Credit")
              if (description) {
                const creditPatterns = [
                  /(?:plus|including)\s+\$([\d,]+)/i, // "Plus $12,500" or "Including $12,500"
                  /\$([\d,]+)\s+(?:air\s+)?credit/i, // "$12,500 Air Credit" or "$12,500 Credit"
                  /\$([\d,]+)\s+air\s+credit/i, // "$12,500 Air Credit" (more specific)
                ];

                for (const pattern of creditPatterns) {
                  const creditMatch = description.match(pattern);
                  if (creditMatch && creditMatch[1]) {
                    const creditAmount = parseNumber(creditMatch[1]);
                    if (creditAmount && !cashValue) {
                      cashValue = creditAmount;
                      break; // Use first match
                    }
                  }
                }
              }
            } else if (eyebrowLower === "including" || eyebrowLower === "plus") {
              // Discounts or credits - this applies to ALL offer types (lease, finance, cash)
              const amount = parseNumber(headline);
              if (amount) {
                // Set cashback for all offer types when we see "Including" or "Plus"
                // For financing offers, "Plus" indicates cashback (e.g., "Plus $7,500 Air Credits")
                // For lease offers, "Including" indicates total discounts (e.g., "Including $16,500 in total discounts")
                // Always set cashback if we have an amount, but prefer "Plus" for financing if both exist
                if (eyebrowLower === "plus" || !cashValue) {
                  cashValue = amount;
                }
              }
            } else if (offerType === "cash" && headline) {
              // For cash offers, if we have a headline but no eyebrow match, try to parse it as price
              const price = parseNumber(headline);
              if (price && !offerAmount) {
                offerAmount = price;
              }
              // Also check description for credits
              if (description) {
                const creditPatterns = [
                  /(?:plus|including)\s+\$([\d,]+)/i,
                  /\$([\d,]+)\s+(?:air\s+)?credit/i,
                  /\$([\d,]+)\s+air\s+credit/i,
                ];

                for (const pattern of creditPatterns) {
                  const creditMatch = description.match(pattern);
                  if (creditMatch && creditMatch[1]) {
                    const creditAmount = parseNumber(creditMatch[1]);
                    if (creditAmount && !cashValue) {
                      cashValue = creditAmount;
                      break;
                    }
                  }
                }
              }
            }
          }

          // Build the combined description from all spec parts
          // Format: Join all parts with double newline, or single space for cash offers
          if (specParts.length > 0) {
            if (offerType === "cash") {
              // For cash offers, combine into a single line: "From $79,900 Plus $12,500 Air Credit discount for Cash Purchases"
              terms = specParts.join(" ");
            } else {
              // For lease and finance, use double newline: "From $599/mo for 36 months...\n\nIncluding $16,500..."
              terms = specParts.join("\n\n");
            }
          }

          // Only create offer if we have meaningful data
          // Log what we found for debugging (especially for cash and financing offers)
          if (offerType === "cash" || offerType === "financing") {
            const logData: any = {
              offerAmount,
              cashValue,
              specContainersCount: specContainers.length,
              hasOfferAmount: !!offerAmount,
              hasCashValue: !!cashValue,
            };
            if (offerType === "financing") {
              logData.aprRate = aprRate;
            }
          }

          const hasValidData =
            (offerType === "lease" && leaseMonthlyPayment) ||
            (offerType === "financing" && aprRate) ||
            (offerType === "cash" && (offerAmount || cashValue));

          if (!hasValidData) {
            console.warn(`Skipping ${offerType} offer for ${model} ${year} - insufficient data:`, {
              offerType,
              leaseMonthlyPayment,
              aprRate,
              offerAmount,
              cashValue,
              specContainersCount: specContainers.length,
            });
          }

          if (hasValidData) {
            // Extract expiration date from terms (common expiration is December 31, 2025)
            const expirationDate = extractExpirationDateFromText(terms || "");

            // Bonus/discount: extract from terms (and finePrint if present)
            const combinedText = [terms || "", null].filter(Boolean).join("\n");
            const loyaltyBonus = extractAmountNearKeyword(
              combinedText,
              /loyalty\s*(?:bonus|cash|rebate)?/i,
            );
            const conquestBonus = extractAmountNearKeyword(
              combinedText,
              /conquest\s*(?:bonus|cash|rebate)?/i,
            );
            const militaryDiscount = extractAmountNearKeyword(
              combinedText,
              /military\s*(?:discount|bonus|rebate)?/i,
            );
            const collegeGrad = extractAmountNearKeyword(
              combinedText,
              /college\s*(?:grad|graduate|rebate|bonus)?/i,
            );
            const firstResponder = extractAmountNearKeyword(
              combinedText,
              /first\s*responder\s*(?:discount|bonus|rebate)?/i,
            );

            offers.push({
              brand: "Lucid",
              year,
              make: "Lucid",
              model,
              modelCode: null,
              trim: null,
              offerType,
              // Cash: From price (e.g. $70,900) = offerAmount; Plus $12,500 Air Credit = cashValue
              offerAmount: offerAmount ?? null,
              aprRate: aprRate ? aprRate / 100 : null, // Convert percentage to decimal
              aprTermMonths: offerType === "financing" ? aprTermMonths : null,
              leaseTermMonths: offerType === "lease" ? leaseTermMonths : null,
              cashValue,
              leaseDueAtSigning,
              leaseMonthlyPayment,
              milesPerYear: null,
              expirationDate,
              terms: terms || null,
              finePrint: null, // Fine print is in separate disclaimers on the page
              scrapedAt,
              sourceUrl: LucidSourceUrl,
              loyaltyBonus: loyaltyBonus ?? null,
              conquestBonus: conquestBonus ?? null,
              militaryDiscount: militaryDiscount ?? null,
              collegeGrad: collegeGrad ?? null,
              firstResponder: firstResponder ?? null,
            });
          }
        }
      } catch (err: any) {
        console.error("Error parsing offer card:", err?.message || err);
        // Continue processing other cards
      }
    }

    console.log("Lucid incentives found:", offers.length);

    const result = await storeScrapedIncentives({
      brand: "Lucid",
      offers: offers as NormalizedIncentiveOffer[],
      source: "lucid",
      scrapeEventId,
    });
    if (!result.success) {
      return { success: false, totalOffers: 0, error: result.error };
    }
    return { success: true, totalOffers: result.stored };
  } catch (error: any) {
    console.error("Error scraping Lucid offers:", error);
    const message = error?.message || "Internal server error while scraping Lucid offers";
    await markScrapeEventFailed(scrapeEventId, message, {
      brand: "Lucid",
      source: "lucid",
    });
    return { success: false, error: message };
  }
}
