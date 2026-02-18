import { storeScrapedIncentives, type NormalizedIncentiveOffer } from "@/lib/incentives/storeScrapedIncentives";

// Public-facing URL for Honda offers (stored in DB)
const HONDA_SOURCE_URL = "https://automobiles.honda.com/tools/current-offers";

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

function extractAmountNearKeyword(
  text: string | null | undefined,
  keyword: RegExp,
): number | null {
  if (!text) return null;
  try {
    const kw = `(?:${keyword.source})`;
    const afterKeyword = new RegExp(`${kw}[\\s\\S]{0,80}?\\$([\\d,]+)`, "i");
    let match = text.match(afterKeyword);
    if (match && match[1]) return parseNumber(match[1]);
    const beforeKeyword = new RegExp(`\\$([\\d,]+)[\\s\\S]{0,80}?${kw}`, "i");
    match = text.match(beforeKeyword);
    if (match && match[1]) return parseNumber(match[1]);
    return null;
  } catch {
    return null;
  }
}

const fetchOfferData = async (zipCode: string = "95556") => {
  const url = `https://automobiles.honda.com/platform/api/v1/specials?zipCode=${zipCode}`;

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow" as RequestRedirect,
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-encoding": "gzip, deflate, br, zstd",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      "cache-control": "max-age=0",
      cookie:
        "hpf_id=0e5371a7-d164-41ef-a445-5a034101f248; geocalled=true; cleared-onetrust-cookies=; __td_blockEvents=false; __td_signed=true; s_cc=true; shell#lang=en; zipcode=95556; OptanonAlertBoxClosed=2026-02-02T19:52:51.890Z; RT=\"z=1&dm=automobiles.honda.com&si=7e0be734-1a15-46d8-b7ea-c950d8c09129&ss=ml5l66gs&sl=2&tt=16k&rl=1\"; OptanonConsent=isGpcEnabled=0&datestamp=Mon+Feb+02+2026+19%3A55%3A16+GMT%2B0000+(Greenwich+Mean+Time)&version=202501.1.0&browserGpcFlag=0&isIABGlobal=false&identifierType=eUserIdent&hosts=&consentId=d91f1406-9f23-4a70-b08e-456d2fef6808&interactionCount=1&isAnonUser=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A0&iType=6&intType=6&geolocation=%3B&AwaitingReconsent=false; _evga_602a={\"uuid\":\"8ee73f12eabecb83\"}; _td=15d31f9e-e5e4-4a0f-b920-4dc1e132c5c5; _sfid_c97e={\"anonymousId\":\"8ee73f12eabecb83\"%2C\"consents\":[]}; s_fid=6ADCF9B57960B2D0-2C53482D798031D6; ak_bmsc=FE4B2C1AB634C6B13A7CBA85F58789B6~000000000000000000000000000000~YAAQW0vdWNxTRx+cAQAAI+AEJB4fRB/koRBZecdlqfHDXqQYUq/5VvFvxANyB9B7cwiGxyrI4tPxI/MQj3z3wYXtm2HG8scXXmKvTbWXNvCAxUUGoFb4FCPRNn4EMJ3w/8hMygVR8F0KkRBc2rpfajKVUpMAWsGHzDtmul7sw7zQtSPFBbiYJjVXH7h+LfNb89bC4569EShJXb47lapqjcwyWCrM5lJQJRusDH0lsgE/SjqQe97L8ASS4fu0AEb9NiA0AETZXC6h9M7tMKqYbiuCCbakZUbKHUQnIRhMadEcm67iUnyhlRhCdJQfD9MRqksg0TH2GCNLRFpv05VJLNrM1OgWwPdtWIlNhfmEAwWe3REXbyIOBvvDQ43xXThgYU+c; s_sq=%5B%5BB%5D%5D; AKA_A2=A",
      priority: "u=0, i",
      "sec-ch-ua":
        '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    console.error("Failed to fetch Honda offers:", response.status);
    throw new Error(`Failed to fetch Honda offers: ${response.status}`);
  }

  const data = await response.json();

  if (!data || !data.Offers || !Array.isArray(data.Offers)) {
    console.warn("No offers data found in response");
    return [];
  }

  const offers = data.Offers.filter((offer: any) => offer.SalesProgramType === "Lease" || offer.SalesProgramType === "Finance").map((offer: any) => {
    // Determine offer type
    let offerType: string;
    switch (offer.SalesProgramType) {
      case "Lease":
        offerType = "lease";
        break;
      case "Finance":
        offerType = "financing";
        break;
      default:
        return null;
    }

    // Extract lease information
    let leaseMonthlyPayment: number | null = null;
    let leaseDueAtSigning: number | null = null;
    let leaseTermMonths: number | null = null;
    let milesPerYear: number | null = null;
    
    // Extract finance information (APR and term)
    let aprRate: number | null = null;
    let aprTermMonths: number | null = null;

    
    if (offerType === "lease" && offer.LeasePaymentInfo) {
      // Lease-specific logic handled below via LeasePaymentInfo
      leaseMonthlyPayment = offer.LeasePaymentInfo.BaseMonthlyPayment || null;
      leaseDueAtSigning = offer.LeasePaymentInfo.TotalDueAtSigning || null;
      leaseTermMonths = offer.LeasePaymentInfo.TermMonths || null;
      if (offer.LeasePaymentInfo.AnnualMiles) {
        milesPerYear = parseInt(offer.LeasePaymentInfo.AnnualMiles, 10) || null;
      }
    } else if (
      offerType === "financing" &&
      offer.PaymentTerms &&
      offer.PaymentTerms.FinanceTerms &&
      Array.isArray(offer.PaymentTerms.FinanceTerms)
    ) {
      // Finance-specific logic handled below via PaymentTerms
      const financeTerm = offer.PaymentTerms.FinanceTerms[0];
      if (financeTerm && financeTerm.APR !== null && financeTerm.APR !== undefined) {
        aprRate = Number(financeTerm.APR) / 100; // Convert percentage to decimal
        // Use termMax if available, otherwise termMin
        aprTermMonths = parseInt(financeTerm.TermMax ?? financeTerm.TermMin ?? "0", 10) || null;
      }
    }

    
    // Extract expiration date
    const expirationDate = offer.EndDate ? new Date(offer.EndDate).toISOString() : null;

    // Extract model information
    const model = offer.ModelGroupName || offer.VehicleCategoryName || null;
    const trim = offer.ModelTrim || null;
    const year = offer.ModelYear || null;

    const terms = offer.SpecialShortDescription || null;
    const finePrint = offer.SpecialDescription || offer.ShortDisclaimer || null;
    const combinedText = [terms, finePrint].filter(Boolean).join(" ");

    // Honda API: "LOYALTY or CONQUEST AWARD AMOUNT" in description (e.g. "$1,500.00 LOYALTY or CONQUEST AWARD AMOUNT")
    const loyConqAmountMatch = combinedText.match(
      /\$([\d,]+)\s+LOYALTY\s+or\s+CONQUEST\s+AWARD\s+AMOUNT/i,
    );
    const loyConqFromText =
      loyConqAmountMatch && loyConqAmountMatch[1]
        ? parseNumber(loyConqAmountMatch[1])
        : null;

    

    let militaryDiscount: number | null = null;
    let collegeGrad: number | null = null;
    let loyaltyBonus: number | null = null;
    let conquestBonus: number | null = null;
    
    const allOffers = data.Offers || [];
    (offer.OfferAttributes || []).forEach((attribute: string) => {
      switch (attribute) {
        case "military":
          militaryDiscount = allOffers.find((o: any) => o.SalesProgramType === "Military" && (o.ApplicableModelIds || []).includes(offer.ModelId))?.OfferAmount ?? null;
          if (militaryDiscount != null) militaryDiscount = parseNumber(militaryDiscount) ?? militaryDiscount;
          break;
        case "graduate":
          collegeGrad = allOffers.find((o: any) => o.SalesProgramType === "Conquest" && (o.ApplicableModelIds || []).includes(offer.ModelId))?.OfferAmount ?? null;
          if (collegeGrad != null) collegeGrad = parseNumber(collegeGrad) ?? collegeGrad;
          break;
        case "LoyConq":
          const loyConqAmt = allOffers.find((o: any) => o.SalesProgramType === "AcuraLoyaltyConquest" && (o.ApplicableModelIds || []).includes(offer.ModelId))?.OfferAmount ?? null;
          const parsed = loyConqAmt != null ? parseNumber(loyConqAmt) : null;
          if (parsed != null) loyaltyBonus = conquestBonus = parsed;
          break;
      }
    });

    loyaltyBonus =
      loyaltyBonus ??
      loyConqFromText ??
      extractAmountNearKeyword(
        combinedText,
        /loyalty\s*(?:bonus|cash|credit|rebate)?/i,
      );
    conquestBonus =
      conquestBonus ??
      loyConqFromText ??
      extractAmountNearKeyword(
        combinedText,
        /conquest\s*(?:bonus|cash|rebate)?/i,
      );

    militaryDiscount =
      militaryDiscount ??
      extractAmountNearKeyword(
        combinedText,
        /military\s+(?:and\s+first\s+responders?)?\s*bonus|military\s*(?:discount|bonus|rebate)?/i,
      );

    collegeGrad =
      collegeGrad ??
      (() => {
        const directMatch = combinedText.match(
          /\$([\d,]+)\s+College\s+Graduate\s+Bonus/i,
        );
        if (directMatch && directMatch[1]) return parseNumber(directMatch[1]);
        return extractAmountNearKeyword(
          combinedText,
          /college\s+graduate\s+bonus|college\s+grad(?:uate)?/i,
        );
      })();

    const firstResponder = extractAmountNearKeyword(
      combinedText,
      /first\s+responders?\s+bonus|first\s*responder\s*(?:discount|bonus|rebate)?/i,
    );

    return {
      brand: "Honda",
      year: year,
      make: "Honda",
      model: model,
      modelCode: offer.ModelId || null,
      trim: trim,
      offerType: offerType,
      offerAmount: null,
      aprRate: aprRate,
      aprTermMonths: aprTermMonths,
      leaseTermMonths: leaseTermMonths,
      cashValue: null,
      tradeDiscount: null,
      leaseDueAtSigning: leaseDueAtSigning,
      leaseMonthlyPayment: leaseMonthlyPayment,
      milesPerYear: milesPerYear,
      terms,
      finePrint,
      expirationDate: expirationDate,
      sourceUrl: HONDA_SOURCE_URL,
      loyaltyBonus: loyaltyBonus ?? null,
      conquestBonus: conquestBonus ?? null,
      militaryDiscount: militaryDiscount ?? null,
      collegeGrad: collegeGrad ?? null,
      firstResponder: firstResponder ?? null,
    };
  });

  return offers;
};

export async function scrapeOffersFromHonda(zipCode: string = "95556") {
  try {
    const offers = await fetchOfferData(zipCode);

    if (offers.length === 0) {
      console.warn("No Honda offers found");
      return { success: false, error: "No offers found" };
    }

    console.log("Honda incentives found:", offers.length);

    const result = await storeScrapedIncentives({
      brand: "Honda",
      offers: offers as NormalizedIncentiveOffer[],
      source: "honda",
    });
    if (!result.success) {
      return { success: false, totalOffers: 0, error: result.error };
    }
    return { success: true, totalOffers: result.stored };
  } catch (err: any) {
    console.error("Error scraping Honda offers:", err?.message || err);
    return { success: false, error: err?.message || err };
  }
}
