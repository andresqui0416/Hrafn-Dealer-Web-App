import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function scrapeOffersFromAudi() {
  try {
    const headers = new Headers();
    headers.append("apollographql-client-name", "fa-vlp-list-page");
    headers.append("apollographql-client-version", "5.17.4");
    headers.append("Content-Type", "application/json");

    const body = JSON.stringify({
      operationName: "UsCustomerOffers",
      variables: {
        zipCode: "",
      },
      query:
        "query UsCustomerOffers($zipCode: String, $offerMonth: String) {\n  usCustomerOffers(zipCode: $zipCode, offerMonth: $offerMonth) {\n    zipClusterID\n    offerModelDetail {\n      modelCode\n      modelYear\n      bodyType\n      trimline\n      productModelCode\n      modelCodeDescription\n      msrp\n      modelFamily\n      __typename\n    }\n    stackableOffers {\n      offerType\n      creditBonus\n      programShortDescription\n      offerDisclaimer\n      programName\n      __typename\n    }\n    offerDisclaimer\n    offerImageUrl\n    featuredOfferImageUrl\n    programName\n    offerType\n    programPriority\n    programFromDate\n    programToDate\n    programShortDescription\n    region\n    zipClusterID\n    aprRate\n    creditBonus\n    term\n    totalDueAtSign\n    customerDownPayment\n    monthlyPayment\n    __typename\n  }\n}",
    });

    const response = await fetch("https://api.audiusa.com/graphql", {
      method: "POST",
      headers,
      body,
      redirect: "follow",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Audi API error:", response.status, text);
      throw new Error(`Audi API request failed: ${response.status}`);
    }
    const data = await response.json();

    if (!data?.data?.usCustomerOffers || !Array.isArray(data.data.usCustomerOffers)) {
      console.error("Unexpected API response structure:", JSON.stringify(data, null, 2));
      return { success: false, error: "Unexpected API response structure" };
    }

    const offers: any[] = [];
    const scrapedAt = new Date();

    // Extract offer data from each offer
    for (const offer of data.data.usCustomerOffers) {
      const modelDetail = offer.offerModelDetail || {};
      
      // Parse dates from format "20251202" (YYYYMMDD)
      let expirationDate: Date | null = null;
      if (offer.programToDate) {
        try {
          const year = parseInt(offer.programToDate.substring(0, 4));
          const month = parseInt(offer.programToDate.substring(4, 6)) - 1; // Month is 0-indexed
          const day = parseInt(offer.programToDate.substring(6, 8));
          expirationDate = new Date(year, month, day);
          if (isNaN(expirationDate.getTime())) {
            expirationDate = null;
          }
        } catch {
          expirationDate = null;
        }
      }

      // Map offerType from API to our schema
      let offerType = "cash";
      if (offer.offerType === "lease") {
        offerType = "lease";
      } else if (offer.offerType === "finance") {
        offerType = "financing";
      } else if (offer.offerType === "credit") {
        offerType = "cash"; // Credit bonuses are cash offers
      }

      // Extract offer amount - use creditBonus for credit offers, monthlyPayment for lease/finance
      let offerAmount: number | null = null;
      if (offer.creditBonus && offer.creditBonus > 0) {
        offerAmount = offer.creditBonus;
      } else if (offer.monthlyPayment && offer.monthlyPayment > 0) {
        offerAmount = offer.monthlyPayment;
      }

      // Create offer record
      offers.push({
        brand: "Audi",
        year: modelDetail.modelYear || null,
        make: "Audi",
        model: modelDetail.modelFamily || null,
        modelCode: modelDetail.modelCode || null,
        trim: modelDetail.trimline || null,
        offerType,
        offerAmount,
        apr: offer.aprRate && offer.aprRate > 0 ? offer.aprRate : null,
        termMonths: offer.term && offer.term > 0 ? offer.term : null,
        cashBack: offer.creditBonus && offer.creditBonus > 0 ? offer.creditBonus : null,
        dueAtSigning: offer.totalDueAtSign && offer.totalDueAtSign > 0 ? offer.totalDueAtSign : null,
        monthlyPayment: offer.monthlyPayment && offer.monthlyPayment > 0 ? offer.monthlyPayment : null,
        expirationDate,
        terms: offer.programShortDescription || null,
        finePrint: offer.offerDisclaimer || null,
        scrapedAt,
      });

      // Also process stackable offers (additional offers that can be combined)
      // if (offer.stackableOffers && Array.isArray(offer.stackableOffers)) {
      //   for (const stackableOffer of offer.stackableOffers) {
      //     if (stackableOffer.creditBonus && stackableOffer.creditBonus > 0) {
      //       offers.push({
      //         brand: "Audi",
      //         year: modelDetail.modelYear || null,
      //         make: "Audi",
      //         model: modelDetail.modelFamily || null,
      //         modelCode: modelDetail.modelCode || null,
      //         trim: modelDetail.trimline || null,
      //         offerType: "cash", // Stackable offers are typically credit bonuses
      //         offerAmount: stackableOffer.creditBonus,
      //         cashBack: stackableOffer.creditBonus,
      //         expirationDate, // Use same expiration as main offer
      //         terms: stackableOffer.programShortDescription || null,
      //         finePrint: stackableOffer.offerDisclaimer || null,
      //         scrapedAt,
      //       });
      //     }
      //   }
      // }
    }

    console.log("Offers:", offers.length);
    
    // Delete all existing offers for this brand first
    const brand = offers.length > 0 ? offers[0].brand : "Audi";
    await prisma.offers.deleteMany({
      where: {
        brand: brand,
      },
    });
    console.log(`Deleted all existing ${brand} offers`);

    // Store offers in database - process in batches to avoid transaction timeout
    if (offers.length > 0) {
      const BATCH_SIZE = 10; // Process 10 offers at a time
      for (let i = 0; i < offers.length; i += BATCH_SIZE) {
        const batch = offers.slice(i, i + BATCH_SIZE);
        await prisma.$transaction(
          async (tx) => {
            for (const offer of batch) {
              try {
                // Create new offer (public data, no dealer ownership)
                await tx.offers.create({
                  data: {
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
                    terms: offer.terms,
                    finePrint: offer.finePrint,
                    expirationDate: offer.expirationDate,
                    scrapedAt: offer.scrapedAt,
                  },
                });
              } catch (err: any) {
                // Log but don't fail on individual record errors
                console.error("Error storing offer:", err?.message || err);
              }
            }
          },
          {
            maxWait: 10000, // Maximum time to wait for a transaction slot
            timeout: 30000, // Maximum time the transaction can run (30 seconds)
          },
        );
      }
    }

    return { success: true, totalOffers: offers.length };
  } catch (error: any) {
    console.error("Error scraping Audi offers:", error);
    return { success: false, error: error?.message || "Internal server error while scraping Audi offers" };
  }
}