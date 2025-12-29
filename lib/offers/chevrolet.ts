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

// Extract monthly payment from HTML
function extractMonthlyPaymentFromHTML(html: string | null | undefined): number | null {
  if (!html) return null;
  try {
    // Extract amount before "/month" pattern (e.g., "$289/month")
    const monthPattern = /<[^>]*>\$([\d,]+)\s*\/\s*month/i;
    const monthMatch = html.match(monthPattern);
    if (monthMatch && monthMatch[1]) {
      // Verify it's not before "Costco", "toward the purchase", or "Loyalty Cash"
      const matchContext = monthMatch[0];
      if (!/Costco|toward\s+the\s+purchase|Loyalty\s+Cash/i.test(matchContext)) {
        return parseNumber(monthMatch[1]);
      }
    }
    
    // Extract amount before "Per" followed by "Month"
    // Pattern: <sup>$</sup>NUMBER</span> followed by "Per" and "Month"
    const perMonthPattern = /<sup>\$<\/sup>([\d,]+)<\/span>[\s\S]*?Per[\s\S]*?Month/i;
    const perMonthMatch = html.match(perMonthPattern);
    if (perMonthMatch && perMonthMatch[1]) {
      // Verify it's not before "Costco", "toward the purchase", or "Loyalty Cash"
      const matchContext = perMonthMatch[0];
      if (!/Costco|toward\s+the\s+purchase|Loyalty\s+Cash/i.test(matchContext)) {
        return parseNumber(perMonthMatch[1]);
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Extract monthly payment from text
function extractMonthlyPayment(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    // Extract amount before "/month" pattern (e.g., "$289/month")
    let match = text.match(/\$([\d,]+)\s*\/\s*month/i);
    if (match && match[1]) {
      // Verify it's not before "Costco", "toward the purchase", or "Loyalty Cash"
      const matchIndex = text.indexOf(match[0]);
      const beforeMatch = text.substring(Math.max(0, matchIndex - 50), matchIndex);
      const afterMatch = text.substring(matchIndex + match[0].length, matchIndex + match[0].length + 50);
      if (!/Costco|toward\s+the\s+purchase|Loyalty\s+Cash/i.test(beforeMatch + afterMatch)) {
        return parseNumber(match[1]);
      }
    }
    
    // Extract amount before "Per" followed by "Month"
    // Try "$329 Per Month" pattern
    match = text.match(/\$([\d,]+)\s+Per\s+Month/i);
    if (match && match[1]) {
      // Verify it's not before "Costco", "toward the purchase", or "Loyalty Cash"
      const matchIndex = text.indexOf(match[0]);
      const beforeMatch = text.substring(Math.max(0, matchIndex - 50), matchIndex);
      if (!/Costco|toward\s+the\s+purchase|Loyalty\s+Cash/i.test(beforeMatch)) {
        return parseNumber(match[1]);
      }
    }
    
    // Try "329 Per Month" pattern (without dollar sign)
    match = text.match(/(\d{1,4}(?:,\d{3})?)\s+Per\s+Month/i);
    if (match && match[1]) {
      // Verify it's not before "Costco", "toward the purchase", or "Loyalty Cash"
      const matchIndex = text.indexOf(match[0]);
      const beforeMatch = text.substring(Math.max(0, matchIndex - 50), matchIndex);
      if (!/Costco|toward\s+the\s+purchase|Loyalty\s+Cash/i.test(beforeMatch)) {
        return parseNumber(match[1]);
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Extract term months from text (e.g., "for 36 months" or "36 months, $1,329 due at signing")
function extractTermMonths(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    // Try "for X months" pattern first
    let match = text.match(/for\s+(\d+)\s+months?/i);
    if (match && match[1]) {
      const term = parseInt(match[1], 10);
      if (!isNaN(term) && term > 0) return term;
    }
    // Try "X months" pattern before "due at signing"
    match = text.match(/(\d+)\s+months?[,\s]+(?:\$[\d,]+\s+)?due\s+at\s+signing/i);
    if (match && match[1]) {
      const term = parseInt(match[1], 10);
      if (!isNaN(term) && term > 0 && term <= 120) return term;
    }
    // Fallback: Try any "X months" pattern
    match = text.match(/(\d+)\s+months?/i);
    if (match && match[1]) {
      const term = parseInt(match[1], 10);
      if (!isNaN(term) && term > 0 && term <= 120) return term;
    }
    return null;
  } catch {
    return null;
  }
}

// Extract due at signing amount from text
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

// Extract APR from HTML
function extractAPRFromHTML(html: string | null | undefined): number | null {
  if (!html) return null;
  try {
    const h3Match = html.match(/<h3[^>]*>[\s\S]*?<span[^>]*>([\d,]+\.?\d*)%<\/span>[\s\S]*?APR/i);
    if (h3Match && h3Match[1]) {
      const apr = parseFloat(h3Match[1].replace(/,/g, ''));
      if (!isNaN(apr) && apr >= 0 && apr <= 100) {
        return apr / 100;
      }
    }
    const spanMatch = html.match(/<span[^>]*>([\d,]+\.?\d*)%<\/span>[\s\S]*?APR/i);
    if (spanMatch && spanMatch[1]) {
      const apr = parseFloat(spanMatch[1].replace(/,/g, ''));
      if (!isNaN(apr) && apr >= 0 && apr <= 100) {
        return apr / 100;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Extract APR from text
function extractAPR(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/(\d+\.?\d*)\s*%?\s*apr/i);
    if (match && match[1]) {
      const apr = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(apr) && apr >= 0 && apr <= 100) {
        return apr / 100;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Extract trade discount from HTML
function extractTradeDiscountFromHTML(html: string | null | undefined): number | null {
  if (!html) return null;
  try {
    const supMatch = html.match(/<sup>\$<\/sup>([\d,]+)<\/span>[\s\S]*?Total\s+Value[\s\S]*?trade[- ]?in/i);
    if (supMatch && supMatch[1]) {
      return parseNumber(supMatch[1]);
    }
    const spanMatch = html.match(/<span[^>]*>[\s\S]*?\$([\d,]+)[\s\S]*?<\/span>[\s\S]*?Total\s+Value[\s\S]*?trade[- ]?in/i);
    if (spanMatch && spanMatch[1]) {
      return parseNumber(spanMatch[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract trade discount from text
function extractTradeDiscount(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const match = text.match(/\$([\d,]+)\s+Total\s+Value/i);
    if (match && match[1] && (text.toLowerCase().includes("trade") || text.toLowerCase().includes("trade-in") || text.toLowerCase().includes("trade in"))) {
      return parseNumber(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

// Extract expiration date from HTML
function extractExpirationDateFromHTML(html: string | null | undefined): Date | null {
  if (!html) return null;
  try {
    const patterns = [
      /(?:Take\s+new\s+retail\s+delivery\s+by|by|Take\s+delivery\s+by)\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
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

// Strip HTML and decode entities to plain text
function stripHtmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  try {
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<\/p>/gi, "\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<\/div>/gi, "\n")
      .replace(/<div[^>]*>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, " ");

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

    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n\s+/g, "\n");
    text = text.replace(/\s+\n/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.trim();
    return text || null;
  } catch {
    return null;
  }
}

// Extract text content from HTML - returns main text and fine print separately
function extractTextFromHTML(html: string | null | undefined): { mainText: string; finePrint: string } {
  let mainText = "";
  let finePrint = "";
  
  if (!html) return { mainText: "", finePrint: "" };
  
  try {
    // If it's a full HTML document, extract body content
    let contentHtml = html;
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      contentHtml = bodyMatch[1];
    }
    
    // Helper to extract nested element content (handles nested tags properly)
    // Returns raw HTML content - button text extraction is handled by extractTextFromSection
    function extractNestedElement(html: string, tagName: string, className?: string): string | null {
      let pattern: RegExp;
      if (className) {
        pattern = new RegExp(`<${tagName}[^>]*class="[^"]*${className}[^"]*"[^>]*>`, 'i');
      } else {
        pattern = new RegExp(`<${tagName}[^>]*>`, 'i');
      }
      
      const startMatch = html.match(pattern);
      if (!startMatch) return null;
      
      const tagStart = startMatch.index!;
      const contentStart = tagStart + startMatch[0].length;
      let depth = 1;
      let pos = contentStart;
      const openTagRegex = new RegExp(`<${tagName}(?:\\s|>|/)`, 'i');
      const closeTag = `</${tagName}>`;
      
      while (pos < html.length && depth > 0) {
        const remaining = html.substring(pos);
        
        // Check for closing tag
        if (remaining.startsWith(closeTag)) {
          depth--;
          if (depth === 0) {
            return html.substring(contentStart, pos);
          }
          pos += closeTag.length;
          continue;
        }
        
        // Check for opening tag
        const openMatch = remaining.match(openTagRegex);
        if (openMatch && openMatch.index === 0) {
          depth++;
          // Skip to the end of this tag (find the >)
          const gtIndex = remaining.indexOf('>');
          if (gtIndex > 0) {
            pos += gtIndex + 1;
          } else {
            pos += openMatch[0].length;
          }
          continue;
        }
        
        pos++;
      }
      return null;
    }
    
    // First, find all adv-col elements with col-sm-12
    const advColMatches = Array.from(contentHtml.matchAll(/<adv-col[^>]*class="[^"]*col-sm-12[^"]*"[^>]*>/gi));
    
    for (const advColMatch of advColMatches) {
      const advColStart = advColMatch.index!;
      const advColContent = extractNestedElement(contentHtml.substring(advColStart), 'adv-col');
      
      if (!advColContent) continue;
      
      // Find col-con divs within this adv-col
      const colConMatches = Array.from(advColContent.matchAll(/<div[^>]*class="[^"]*col-con[^"]*"[^>]*>/gi));
      
      for (const colConMatch of colConMatches) {
        const colConStart = colConMatch.index!;
        const colConContent = extractNestedElement(advColContent.substring(colConStart), 'div', 'col-con');
        
        if (!colConContent || colConContent.length < 50) continue;
        
        // Check if this col-con contains offer content
        const hasAPR = colConContent.includes('APR');
        const hasPA = colConContent.includes('Purchase Allowance');
        const hasH2 = colConContent.includes('<h2');
        const hasDollarAmount = /\$[\d,]+/.test(colConContent) || /<sup>\$<\/sup>[\d,]+/.test(colConContent);
        const hasPerOrMonth = /Per[\s\S]*?Month|Month[\s\S]*?Per/i.test(colConContent) || 
                             /Per|Month/i.test(colConContent);
        const hasCash = /Cash/i.test(colConContent);
        const hasMonthlyPaymentInH2 = hasH2 && hasDollarAmount && hasPerOrMonth;
        const hasMonthlyPaymentPattern = hasMonthlyPaymentInH2 || /\$[\d,]+\s*\/\s*month/i.test(colConContent);
        const hasButtons = colConContent.includes('View Inventory') || 
                          colConContent.includes('Request Dealer Pricing') ||
                          colConContent.includes('Build &amp; Buy') ||
                          colConContent.includes('See All Offers');
        if ((hasAPR || hasPA || hasMonthlyPaymentInH2 || (hasH2 && hasDollarAmount && hasCash)) && !hasButtons) {
          const extractedText = extractTextFromSection(colConContent);
          if (extractedText && extractedText.trim().length > 20) {
            mainText = extractedText;
            break;
          }
        }
      }
      
      if (mainText && mainText.trim().length > 20) break;
    }
    
    // Fallback 1: try extracting from any col-con with h2 monthly payment
    if (!mainText || mainText.trim().length < 20) {
      const allColConMatches = Array.from(contentHtml.matchAll(/<div[^>]*class="[^"]*col-con[^"]*"[^>]*>/gi));
      
      for (const match of allColConMatches) {
        const matchStart = match.index!;
        const colConContent = extractNestedElement(contentHtml.substring(matchStart), 'div', 'col-con');
        
        if (!colConContent || colConContent.length < 50) continue;
        
        // Check for h2 tag with monthly payment pattern
        const hasH2WithPayment = /<h2[^>]*>[\s\S]*?\$[\d,]+[\s\S]*?(?:Per|Month|month)/i.test(colConContent);
        const hasButtons = colConContent.includes('View Inventory') || 
                          colConContent.includes('Request Dealer Pricing') ||
                          colConContent.includes('Build &amp; Buy') ||
                          colConContent.includes('See All Offers');
        
        if (hasH2WithPayment && !hasButtons) {
          const extractedText = extractTextFromSection(colConContent);
          if (extractedText && extractedText.trim().length > 20) {
            mainText = extractedText;
            break;
          }
        }
      }
    }
    
    // Fallback 2: try extracting from any col-con with gb-headline5 or gb-headline2
    if (!mainText || mainText.trim().length < 20) {
      const allColConMatches = Array.from(contentHtml.matchAll(/<div[^>]*class="[^"]*col-con[^"]*"[^>]*>/gi));
      
      for (const match of allColConMatches) {
        const matchStart = match.index!;
        const colConContent = extractNestedElement(contentHtml.substring(matchStart), 'div', 'col-con');
        
        if (!colConContent || colConContent.length < 50) continue;
        
        const hasHeadline = colConContent.includes('gb-headline5') || colConContent.includes('gb-headline2');
        const hasButtons = colConContent.includes('View Inventory') || 
                          colConContent.includes('Request Dealer Pricing') ||
                          colConContent.includes('Build &amp; Buy') ||
                          colConContent.includes('See All Offers');
        
        if (hasHeadline && !hasButtons) {
          const extractedText = extractTextFromSection(colConContent);
          if (extractedText && extractedText.trim().length > 20) {
            mainText = extractedText;
            break;
          }
        }
      }
    }
    
    // 2. Extract fine print from disclosure section
    // First, try to extract from gb-disclosures element with disclosure-data attribute
    const gbDisclosuresMatch = contentHtml.match(/<gb-disclosures[^>]*disclosure-data=['"]([^'"]+)['"]/i);
    if (gbDisclosuresMatch && gbDisclosuresMatch[1]) {
      try {
        // The disclosure-data is JSON-encoded, decode it
        const decodedData = gbDisclosuresMatch[1]
          .replace(/\\u003c/g, '<')
          .replace(/\\u003e/g, '>')
          .replace(/\\u0026nbsp;/g, ' ')
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'");
        
        // Try to parse as JSON to extract content
        const jsonMatch = decodedData.match(/"content"\s*:\s*"([^"]+)"/i);
        if (jsonMatch && jsonMatch[1]) {
          const content = jsonMatch[1]
            .replace(/\\u003c/g, '<')
            .replace(/\\u003e/g, '>')
            .replace(/\\u0026nbsp;/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");
          const extractedText = extractTextFromSection(content);
          if (extractedText && extractedText.trim().length > 0) {
            finePrint = extractedText.trim();
          }
        }
      } catch (e) {
        // If parsing fails, continue to other methods
      }
    }

    // If fine print not found yet, look for div with class gmst-co-offer-item-offer-disclosure
    if (!finePrint) {
      const disclosureMatch = contentHtml.match(/<div[^>]*class="[^"]*gmst-co-offer-item-offer-disclosure[^"]*"[^>]*>/i);
      if (disclosureMatch) {
        const disclosureStart = disclosureMatch.index!;
        const disclosureContent = extractNestedElement(contentHtml.substring(disclosureStart), 'div', 'gmst-co-offer-item-offer-disclosure');
        if (disclosureContent) {
          // Extract paragraphs and join with newlines
          const paragraphMatches = disclosureContent.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
          const paragraphs: string[] = [];
          
          for (const match of paragraphMatches) {
            if (match[1]) {
              const paragraphText = extractTextFromSection(match[1]);
              if (paragraphText && paragraphText.trim().length > 0) {
                paragraphs.push(paragraphText.trim());
              }
            }
          }
          
          if (paragraphs.length > 0) {
            // Join paragraphs with newlines
            finePrint = paragraphs.join("\n");
          } else {
            // Fallback: extract all text from disclosure
            finePrint = extractTextFromSection(disclosureContent);
          }
        }
      }
    }
    
    return { mainText, finePrint };
  } catch {
    return { mainText: "", finePrint: "" };
  }
}

// Helper function to extract clean text from an HTML section
// Algorithm: Extract ALL text content (including button text) FIRST, then remove HTML tags
function extractTextFromSection(html: string): string {
  if (!html) return "";
  let processedHtml = html;
  
  // Extract text from gb-disclosure elements (button text or direct text content)
  processedHtml = processedHtml.replace(/<gb-disclosure[^>]*>([\s\S]*?)<\/gb-disclosure\s*\n\s*>/gi, (fullMatch, content) => {
    // First try to extract button text
    const buttonMatch = content.match(/<button[^>]*>([\s\S]*?)<\/button>/i);
    if (buttonMatch && buttonMatch[1]) {
      return buttonMatch[1].trim() + " ";
    }
    // If no button, extract direct text content (e.g., "lease*")
    const directText = content.trim();
    return directText ? directText + " " : "";
  });
  
  processedHtml = processedHtml.replace(/<gb-disclosure[^>]*>([\s\S]*?)<\/gb-disclosure>/gi, (fullMatch, content) => {
    if (fullMatch.includes('gb-disclosure')) {
      // First try to extract button text
      const buttonMatch = content.match(/<button[^>]*>([\s\S]*?)<\/button>/i);
      if (buttonMatch && buttonMatch[1]) {
        return buttonMatch[1].trim() + " ";
      }
      // If no button, extract direct text content (e.g., "lease*")
      const directText = content.trim();
      return directText ? directText + " " : "";
    }
    return fullMatch;
  });
  
  processedHtml = processedHtml.replace(/<gb-disclosure[^>]*>([\s\S]*?)<\/gb-disclosure[\s\n]*>/gi, (fullMatch, content) => {
    if (fullMatch.includes('gb-disclosure') && fullMatch.includes('</gb-disclosure')) {
      // First try to extract button text
      const buttonMatch = content.match(/<button[^>]*>([\s\S]*?)<\/button>/i);
      if (buttonMatch && buttonMatch[1]) {
        return buttonMatch[1].trim() + " ";
      }
      // If no button, extract direct text content (e.g., "lease*")
      const directText = content.trim();
      return directText ? directText + " " : "";
    }
    return fullMatch;
  });
  
  // Extract text from standalone buttons
  processedHtml = processedHtml.replace(/<button[^>]*>([\s\S]*?)<\/button>/gi, (match, content) => {
    const buttonText = content.trim();
    return buttonText ? buttonText + " " : "";
  });
  
  // Remove unwanted elements
  processedHtml = processedHtml
    .replace(/<gb-responsive-image[^>]*>[\s\S]*?<\/gb-responsive-image>/gi, "")
    .replace(/<picture[^>]*>[\s\S]*?<\/picture>/gi, "")
    .replace(/<source[^>]*>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<gb-button[^>]*>([\s\S]*?)<\/gb-button>/gi, "$1")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // Remove remaining gb-disclosure and button tags
  processedHtml = processedHtml
    .replace(/<gb-disclosure[^>]*>[\s\S]*?<\/gb-disclosure>/gi, "")
    .replace(/<gb-disclosure[^>]*\/>/gi, "")
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, "");
  
  // Remove attributes with URLs and image paths
  processedHtml = processedHtml
    .replace(/srcset\s*=\s*["'][^"']*["']/gi, "")
    .replace(/src\s*=\s*["'][^"']*["']/gi, "")
    .replace(/href\s*=\s*["'][^"']*["']/gi, "")
    .replace(/data-[^=]*\s*=\s*["'][^"']*["']/gi, "")
    .replace(/https?:\/\/[^\s<>"']+/gi, "")
    .replace(/\/[^\s<>"']*\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s<>"']*)?/gi, "");
  
  // Replace block-level closing tags with newlines
  processedHtml = processedHtml.replace(/<\/div[^>]*class="[^"]*gb-large-margin[^"]*"[^>]*>/gi, "\n\n");
  processedHtml = processedHtml.replace(/<\/div[^>]*class="[^"]*gb-medium-margin[^"]*"[^>]*>/gi, "\n\n");
  processedHtml = processedHtml.replace(/<\/(div|p|h[1-6]|section|article|header|footer|li|br|adv-col|adv-grid|gb-adv-grid|hr)[^>]*>/gi, "\n");
  
  // Replace block-level opening tags with newlines
  processedHtml = processedHtml.replace(/<div[^>]*class="[^"]*gb-large-margin[^"]*"[^>]*>/gi, "\n");
  processedHtml = processedHtml.replace(/<div[^>]*class="[^"]*gb-medium-margin[^"]*"[^>]*>/gi, "\n");
  processedHtml = processedHtml.replace(/<(div|p|h[1-6]|section|article|header|footer|li|br|adv-col|adv-grid|gb-adv-grid|hr)[^>]*>/gi, "\n");
  
  // Remove all remaining HTML tags
  let text = processedHtml.replace(/<[^>]*>/g, " ");
  
  // Decode HTML entities
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
  
  // Remove unwanted patterns
  text = text
    .replace(/\bINVENTORY\b/gi, "")
    .replace(/\bREQUEST DEALER PRICING\b/gi, "")
    .replace(/\bBUILD & BUY\b/gi, "")
    .replace(/\bFEATURED OFFER\b/gi, "")
    .replace(/\s*\*\s*/g, " ")
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/\/[^\s]*\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s]*)?/gi, "")
    .replace(/imwidth=\d+/gi, "")
    .replace(/content\/dam\/[^\s]+/gi, "")
    .replace(/data-disclosure-id[^\s]*/gi, "")
    .replace(/\/content\/[^\s]+/gi, "");
  
  // Normalize whitespace but preserve newlines
  // First, replace multiple spaces/tabs with single space (but not newlines)
  text = text.replace(/[ \t]+/g, " ");
  // Normalize multiple newlines to double newlines
  text = text.replace(/\n\s*\n\s*\n+/g, "\n\n");
  // Remove spaces after newlines
  text = text.replace(/\n\s+/g, "\n");
  // Remove spaces before newlines
  text = text.replace(/\s+\n/g, "\n");
  // Replace multiple spaces (but preserve newlines)
  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.trim();
  
  return text;
}

// Fetch and parse featured offer HTML
async function fetchFeaturedOfferHTML(featuredOfferUrl: string): Promise<string | null> {
  try {
    // Construct full URL - featuredOfferUrl is relative, prepend base URL
    const baseUrl = "https://chevrolet.com";
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

export async function scrapeOffersFromChevrolet() {
  try {
    const myHeaders = new Headers();
    const requestOptions = {
      method: "GET",
      headers: myHeaders,
      redirect: "follow" as RequestRedirect,
    };

    const response = await fetch(
      "https://cws.gm.com/cof-cws/v2/currentoffers/US/en/95556?make=chevrolet&quantumHostname=www.chevrolet.com",
      requestOptions,
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Chevrolet API error:", response.status, text.substring(0, 500));
      throw new Error(`Chevrolet API request failed: ${response.status}`);
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
      const brand = "Chevrolet";
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

          // Extract main text and fine print from HTML
          const { mainText, finePrint: extractedFinePrint } = extractTextFromHTML(html);
          
          // Debug: log if text extraction failed
          if (!mainText || mainText.trim().length < 20) {
            console.warn(`Failed to extract main text from HTML for featured offer: ${model} ${year}`);
            console.warn(`HTML length: ${html.length}, Extracted main text length: ${mainText?.length || 0}`);
            // Check if HTML contains the expected content
            const hasAPR = html.includes('APR');
            const hasPA = html.includes('Purchase Allowance');
            console.warn(`HTML contains APR: ${hasAPR}, Purchase Allowance: ${hasPA}`);
            if (hasAPR || hasPA) {
              // Try to find col-con divs
              const colConCount = (html.match(/<div[^>]*class="[^"]*col-con[^"]*"/gi) || []).length;
              console.warn(`Found ${colConCount} col-con divs in HTML`);
            }
            continue;
          }

          // Extract APR - try HTML first (handles <span>0%</span>&nbsp;APR in h3), then fall back to text
          let apr = extractAPRFromHTML(html);
          if (apr === null) {
            apr = extractAPR(mainText);
          }

          // Extract monthly payment - try HTML first (handles <sup>$</sup>329 structure), then fall back to text
          let monthlyPayment = extractMonthlyPaymentFromHTML(html);
          if (monthlyPayment === null) {
            monthlyPayment = extractMonthlyPayment(mainText);
          }
          
          // Extract other details from main text
          const termMonths = extractTermMonths(mainText);
          const dueAtSigning = extractDueAtSigning(mainText);

          let offerType = "cash";
          // Only mark as lease if monthlyPayment is not null (number was found before "Per Month")
          // If there's "Per Month" but no number before it, it's not a lease
          if (monthlyPayment !== null) {
            offerType = "lease";
          } else if (apr !== null) {
            offerType = "financing";
          }
          
          // Extract cashBack from main text (regardless of offer type)
          let cashBack: number | null = null;
          
          // Priority 1: Look for "Total Cash Allowance" (this is the sum of Customer Cash + Purchase Allowance)
          const totalCashAllowanceMatch = mainText.match(/\$([\d,]+)\s+Total\s+Cash\s+Allowance/i);
          if (totalCashAllowanceMatch && totalCashAllowanceMatch[1]) {
            cashBack = parseNumber(totalCashAllowanceMatch[1]);
          } else {
            // Priority 2: Look for "Customer Cash" pattern (e.g., "$1,500 Customer Cash*" or "$ 1,500 Customer Cash")
            // Pattern handles optional space after $, optional asterisk, and handles cases where "Cash" might be missing
            let customerCashMatch = mainText.match(/\$[\s]*([\d,]+)\s+Customer\s+Cash/i);
            if (customerCashMatch && customerCashMatch[1]) {
              cashBack = parseNumber(customerCashMatch[1]);
            } else {
              // Try pattern without "Cash" - sometimes text might be cut off (e.g., "$ 1,500 Customer")
              customerCashMatch = mainText.match(/\$[\s]*([\d,]+)\s+Customer/i);
              if (customerCashMatch && customerCashMatch[1]) {
                cashBack = parseNumber(customerCashMatch[1]);
              } else {
                // Priority 2b: Look for "Loyalty Cash" pattern (e.g., "$4,000 Loyalty Cash" or "$4,000 Loyalty Cash Allowance")
                // Handle cases like "$4,000 Chevrolet Corvette and Camaro Loyalty Cash Allowance"
                const loyaltyCashMatch = mainText.match(/\$[\s]*([\d,]+)[\s\S]*?Loyalty\s+Cash(?:\s+Allowance)?/i);
                if (loyaltyCashMatch && loyaltyCashMatch[1]) {
                  cashBack = parseNumber(loyaltyCashMatch[1]);
                } else {
                  // Priority 3: Look for "toward the purchase" pattern (e.g., "$1,000 toward the purchase" or "$1,000 toward the purchase or")
                  const towardPurchaseMatch = mainText.match(/\$[\s]*([\d,]+)\s+toward\s+the\s+purchase/i);
                  if (towardPurchaseMatch && towardPurchaseMatch[1]) {
                    cashBack = parseNumber(towardPurchaseMatch[1]);
                  } else {
                    // Priority 4: Look for "Purchase Allowance" pattern
                    const purchaseAllowanceMatch = mainText.match(/\$[\s]*([\d,]+)\s+Purchase\s+Allowance/i);
                    if (purchaseAllowanceMatch && purchaseAllowanceMatch[1]) {
                      cashBack = parseNumber(purchaseAllowanceMatch[1]);
                    } else {
                      // Priority 5: Try uppercase pattern
                      const purchaseAllowanceMatchUpper = mainText.match(/\$[\s]*([\d,]+)\s+PURCHASE\s+ALLOWANCE/i);
                      if (purchaseAllowanceMatchUpper && purchaseAllowanceMatchUpper[1]) {
                        cashBack = parseNumber(purchaseAllowanceMatchUpper[1]);
                      } else {
                        // Priority 6: Look for other patterns like "$X,XXX cash back", "$X,XXX off", "$X,XXX discount", or "$X,XXX bonus cash"
                        const cashBackMatch = mainText.match(/\$[\s]*([\d,]+)\s+(?:cash\s+back|off|discount|bonus\s+cash)/i);
                        if (cashBackMatch && cashBackMatch[1]) {
                          cashBack = parseNumber(cashBackMatch[1]);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          // Note: "Average Finance Savings" is NOT cashback, it's a separate savings calculation

          // Extract trade discount - try HTML first (handles <sup>$</sup>8,185 Total Value when you trade-in), then fall back to text
          let tradeDiscount = extractTradeDiscountFromHTML(html);
          if (tradeDiscount === null) {
            tradeDiscount = extractTradeDiscount(mainText);
          }

          // Extract expiration date from fine print (preferred) or main text or API result
          let expirationDate = extractExpirationDateFromHTML(extractedFinePrint) || 
                              extractExpirationDateFromHTML(mainText) || 
                              extractExpirationDateFromHTML(html);
          if (!expirationDate) {
            expirationDate = parseExpirationDate(result.endEffDate);
          }

          let terms = mainText.trim() || null;
          if (terms) {
            terms = terms.replace(/featured\s+offer/gi, "").trim();
            // Normalize multiple newlines to double newlines
            terms = terms.replace(/\n{3,}/g, "\n\n");
            // Trim each line and join with newlines
            terms = terms.split("\n").map((line: string) => line.trim()).join("\n");
            // Normalize multiple newlines again
            terms = terms.replace(/\n\n+/g, "\n\n").trim();
            terms = terms || null;
          }
          
          // Use extracted fine print (already has newlines between paragraphs)
          const finePrint = extractedFinePrint.trim() || null;

          // Only create offer if we have meaningful data
          // Accept offers if we have any of: APR, monthly payment (for lease), cashback, trade discount, or meaningful text content
          const hasValidData =
            apr !== null ||
            (offerType === "lease" && monthlyPayment !== null) ||
            cashBack !== null ||
            tradeDiscount !== null ||
            (mainText.trim().length > 30); // At least 30 characters of text content

          if (!hasValidData) {
            console.warn(`Skipping featured ${offerType} offer for ${model} ${year} - insufficient data`);
            console.warn(`  mainText length: ${mainText.trim().length}, apr: ${apr}, cashBack: ${cashBack}, tradeDiscount: ${tradeDiscount}`);
            console.warn(`  mainText preview: ${mainText.substring(0, 200)}`);
            console.warn(`=============================`);
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

      // Build terms text from body (remove leading and trailing spaces, preserve newlines)
      let terms = bodyText ? bodyText.trim() : null;
      if (terms) {
        // Normalize multiple newlines to double newlines
        terms = terms.replace(/\n{3,}/g, "\n\n");
        // Trim each line and join with newlines
        terms = terms.split("\n").map((line: string) => line.trim()).join("\n");
        // Normalize multiple newlines again
        terms = terms.replace(/\n\n+/g, "\n\n").trim();
        terms = terms || null;
      }

      // Build fine print from footer - strip HTML and keep only plain text with newlines
      const finePrint = stripHtmlToText(footerText);

      // Don't populate offerAmount from monthlyPayment or cashBack - keep them separate
      // offerAmount should only be set if explicitly extracted from the offer content
      let offerAmount: number | null = null;
      
      // Extract cashBack from body text and footer text (regardless of offer type)
      // Check both bodyText and footerText for cash back patterns
      const combinedText = (bodyText + " " + footerText).trim();
      let cashBack: number | null = null;
      
      // Priority 1: Look for "Total Cash Allowance" (this is the sum of Customer Cash + Purchase Allowance)
      const totalCashAllowanceMatch = combinedText.match(/\$([\d,]+)\s+Total\s+Cash\s+Allowance/i);
      if (totalCashAllowanceMatch && totalCashAllowanceMatch[1]) {
        cashBack = parseNumber(totalCashAllowanceMatch[1]);
      } else {
        // Priority 2: Look for "Customer Cash" pattern (e.g., "$1,500 Customer Cash*" or "$ 1,500 Customer Cash")
        // Pattern handles optional space after $, optional asterisk, and handles cases where "Cash" might be missing
        let customerCashMatch = combinedText.match(/\$[\s]*([\d,]+)\s+Customer\s+Cash/i);
        if (customerCashMatch && customerCashMatch[1]) {
          cashBack = parseNumber(customerCashMatch[1]);
        } else {
          // Try pattern without "Cash" - sometimes text might be cut off (e.g., "$ 1,500 Customer")
          customerCashMatch = combinedText.match(/\$[\s]*([\d,]+)\s+Customer/i);
          if (customerCashMatch && customerCashMatch[1]) {
            cashBack = parseNumber(customerCashMatch[1]);
          } else {
            // Priority 2b: Look for "Loyalty Cash" pattern (e.g., "$4,000 Loyalty Cash" or "$4,000 Loyalty Cash Allowance")
            // Handle cases like "$4,000 Chevrolet Corvette and Camaro Loyalty Cash Allowance"
            const loyaltyCashMatch = combinedText.match(/\$[\s]*([\d,]+)[\s\S]*?Loyalty\s+Cash(?:\s+Allowance)?/i);
            if (loyaltyCashMatch && loyaltyCashMatch[1]) {
              cashBack = parseNumber(loyaltyCashMatch[1]);
            } else {
              // Priority 3: Look for "toward the purchase" pattern (e.g., "$1,000 toward the purchase" or "$1,000 toward the purchase or")
              // This pattern matches even if there's additional text like "or" after "purchase"
              const towardPurchaseMatch = combinedText.match(/\$[\s]*([\d,]+)\s+toward\s+the\s+purchase/i);
              if (towardPurchaseMatch && towardPurchaseMatch[1]) {
                cashBack = parseNumber(towardPurchaseMatch[1]);
              } else {
                // Priority 4: Look for "Purchase Allowance" pattern
                // Pattern handles: "$250 Purchase Allowance" or "$250 PURCHASE ALLOWANCE" (case insensitive)
                const purchaseAllowanceMatch = combinedText.match(/\$[\s]*([\d,]+)\s+Purchase\s+Allowance\.?/i);
                if (purchaseAllowanceMatch && purchaseAllowanceMatch[1]) {
                  cashBack = parseNumber(purchaseAllowanceMatch[1]);
                } else {
                  // Priority 5: Try uppercase pattern
                  const purchaseAllowanceMatchUpper = combinedText.match(/\$[\s]*([\d,]+)\s+PURCHASE\s+ALLOWANCE\.?/i);
                  if (purchaseAllowanceMatchUpper && purchaseAllowanceMatchUpper[1]) {
                    cashBack = parseNumber(purchaseAllowanceMatchUpper[1]);
                  } else {
                    // Priority 6: Look for "Loyalty Cash" pattern (e.g., "$4,000 Loyalty Cash" or "$4,000 Loyalty Cash Allowance")
                    // Handle cases like "$4,000 Chevrolet Corvette and Camaro Loyalty Cash Allowance"
                    const loyaltyCashMatch = combinedText.match(/\$[\s]*([\d,]+)[\s\S]*?Loyalty\s+Cash(?:\s+Allowance)?/i);
                    if (loyaltyCashMatch && loyaltyCashMatch[1]) {
                      cashBack = parseNumber(loyaltyCashMatch[1]);
                    } else {
                      // Priority 7: Look for other patterns like "$X,XXX cash back", "$X,XXX off", "$X,XXX discount", or "$X,XXX bonus cash"
                      const cashBackMatch = combinedText.match(/\$[\s]*([\d,]+)\s+(?:cash\s+back|off|discount|bonus\s+cash)/i);
                      if (cashBackMatch && cashBackMatch[1]) {
                        cashBack = parseNumber(cashBackMatch[1]);
                      }
                    }
                  }
                }
              }
            }
          }
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

    console.log("Chevrolet offers found:", offers.length);

    // Delete all existing Chevrolet offers first
    await prisma.offers.deleteMany({
      where: {
        brand: "Chevrolet",
      },
    });
    console.log("Deleted all existing Chevrolet offers");

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
          console.error("Error storing Chevrolet offer batch:", err?.message || err);
        }
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Chevrolet offers:", error);
    return {
      success: false,
      error: error?.message || "Internal server error while scraping Chevrolet offers",
    };
  }
}