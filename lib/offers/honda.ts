import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const fetchOfferData = async (zipCode: string = "95556") => {
  const url = `https://automobiles.honda.com/platform/api/v1/specials?zipCode=${zipCode}`;

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow" as RequestRedirect,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Referer: "https://automobiles.honda.com/",
      Origin: "https://automobiles.honda.com",
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

  const offers = data.Offers.map((offer: any) => {
    // Determine offer type
    let offerType: string;
    switch (offer.SalesProgramType) {
      case "AcuraConquest":
        offerType = "cash";
        break;
      case "Lease":
        offerType = "lease";
        break;
      case "Finance":
        offerType = "financing";
        break;
      default:
        // Default to cash for unknown types
        offerType = "cash";
        break;
    }

    // Extract lease information
    let leaseMonthlyPayment: number | null = null;
    let leaseDueAtSigning: number | null = null;
    let leaseTermMonths: number | null = null;
    let milesPerYear: number | null = null;

    if (offer.LeasePaymentInfo) {
      leaseMonthlyPayment = offer.LeasePaymentInfo.BaseMonthlyPayment || null;
      leaseDueAtSigning = offer.LeasePaymentInfo.TotalDueAtSigning || null;
      leaseTermMonths = offer.LeasePaymentInfo.TermMonths || null;
      if (offer.LeasePaymentInfo.AnnualMiles) {
        milesPerYear = parseInt(offer.LeasePaymentInfo.AnnualMiles, 10) || null;
      }
    }

    // Extract finance information (APR and term)
    let aprRate: number | null = null;
    let aprTermMonths: number | null = null;
    if (
      offer.PaymentTerms &&
      offer.PaymentTerms.FinanceTerms &&
      Array.isArray(offer.PaymentTerms.FinanceTerms)
    ) {
      // Use the first finance term's APR, or find the best one
      const financeTerm = offer.PaymentTerms.FinanceTerms[0];
      if (financeTerm && financeTerm.APR) {
        aprRate = financeTerm.APR / 100; // Convert percentage to decimal
        // Use termMax if available, otherwise termMin
        if (financeTerm.TermMax) {
          aprTermMonths = financeTerm.TermMax;
        } else if (financeTerm.TermMin) {
          aprTermMonths = financeTerm.TermMin;
        }
      }
    }

    // Extract cash back / offer amount
    let cashValue: number | null = null;
    if (offer.OfferAmount) {
      cashValue = offer.OfferAmount;
    }

    // Extract expiration date
    const expirationDate = offer.EndDate ? new Date(offer.EndDate).toISOString() : null;

    // Extract model information
    const model = offer.ModelGroupName || offer.VehicleCategoryName || null;
    const trim = offer.ModelTrim || null;
    const year = offer.ModelYear || null;

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
      cashValue: cashValue,
      tradeDiscount: null,
      leaseDueAtSigning: leaseDueAtSigning,
      leaseMonthlyPayment: leaseMonthlyPayment,
      milesPerYear: milesPerYear,
      terms: offer.SpecialShortDescription || null,
      finePrint: offer.SpecialDescription || offer.ShortDisclaimer || null,
      expirationDate: expirationDate,
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

    console.log(`Fetched ${offers.length} Honda offers`);

    // Delete existing Honda offers
    await prisma.offers.deleteMany({
      where: {
        brand: "Honda",
      },
    });
    console.log("Deleted all existing Honda offers");

    // Insert new offers in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < offers.length; i += BATCH_SIZE) {
      const batch = offers.slice(i, i + BATCH_SIZE);
      try {
        await prisma.$transaction(async (tx) => {
          await tx.offers.createMany({
            data: batch.map((offer: any) => ({
              brand: offer.brand,
              year: offer.year,
              make: offer.make,
              model: offer.model,
              modelCode: offer.modelCode,
              trim: offer.trim,
              offerType: offer.offerType,
              offerAmount: offer.offerAmount,
              aprRate: offer.aprRate !== null && offer.aprRate !== undefined ? offer.aprRate : null,
              aprTermMonths:
                offer.aprTermMonths !== null && offer.aprTermMonths !== undefined
                  ? offer.aprTermMonths
                  : null,
              leaseTermMonths:
                offer.leaseTermMonths !== null && offer.leaseTermMonths !== undefined
                  ? offer.leaseTermMonths
                  : null,
              cashValue:
                offer.cashValue !== null && offer.cashValue !== undefined ? offer.cashValue : null,
              tradeDiscount: offer.tradeDiscount,
              leaseDueAtSigning:
                offer.leaseDueAtSigning !== null && offer.leaseDueAtSigning !== undefined
                  ? offer.leaseDueAtSigning
                  : null,
              leaseMonthlyPayment:
                offer.leaseMonthlyPayment !== null && offer.leaseMonthlyPayment !== undefined
                  ? offer.leaseMonthlyPayment
                  : null,
              milesPerYear:
                offer.milesPerYear !== null && offer.milesPerYear !== undefined
                  ? offer.milesPerYear
                  : null,
              terms: offer.terms,
              finePrint: offer.finePrint,
              expirationDate: offer.expirationDate ? new Date(offer.expirationDate) : null,
              scrapedAt: new Date(),
            })),
            skipDuplicates: true,
          });
        });
      } catch (err: any) {
        console.error("Error storing Honda offer batch:", err?.message || err);
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (err: any) {
    console.error("Error scraping Honda offers:", err?.message || err);
    return { success: false, error: err?.message || err };
  }
}
