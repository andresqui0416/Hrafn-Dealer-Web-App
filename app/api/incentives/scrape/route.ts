import { NextRequest, NextResponse } from "next/server";
import { storeScrapedIncentives, type NormalizedIncentiveOffer } from "@/lib/incentives/storeScrapedIncentives";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { offers, source, brand } = body;

    if (!offers || !Array.isArray(offers)) {
      return NextResponse.json(
        { success: false, error: "Invalid request: 'offers' must be an array" },
        { status: 400 },
      );
    }

    if (offers.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid request: 'offers' array is empty" },
        { status: 400 },
      );
    }

    const scrapedAtDate = new Date();
    const validOffers: NormalizedIncentiveOffer[] = [];

    for (const offer of offers) {
      if (!offer.brand || !offer.offerType) {
        console.warn("Skipping offer with missing required fields:", {
          brand: offer.brand,
          offerType: offer.offerType,
        });
        continue;
      }

      const leaseMonthlyPayment = offer.leaseMonthlyPayment ?? offer.monthlyPayment;
      const aprRate = offer.aprRate ?? offer.apr;
      const cashValue = offer.cashValue ?? offer.cashBack;
      const leaseDueAtSigning = offer.leaseDueAtSigning ?? offer.dueAtSigning;
      const aprTermMonths =
        offer.aprTermMonths ?? (offer.offerType === "financing" ? offer.termMonths : null);
      const leaseTermMonths =
        offer.leaseTermMonths ?? (offer.offerType === "lease" ? offer.termMonths : null);

      const hasValidData =
        (offer.offerType === "lease" && leaseMonthlyPayment) ||
        (offer.offerType === "financing" && aprRate !== null) ||
        (offer.offerType === "cash" &&
          (offer.offerAmount !== null || cashValue !== null || offer.tradeDiscount !== null));

      if (!hasValidData) {
        console.warn(
          `Skipping ${offer.offerType} offer for ${offer.model} ${offer.year} - insufficient data`,
        );
        continue;
      }

      const sourceUrl = offer.sourceUrl ?? offer.source_url ?? null;
      validOffers.push({
        brand: String(offer.brand),
        year: offer.year != null ? parseInt(String(offer.year), 10) : null,
        make: offer.make ? String(offer.make) : offer.brand,
        model: offer.model ? String(offer.model) : null,
        modelCode: offer.modelCode ? String(offer.modelCode) : null,
        trim: offer.trim ? String(offer.trim) : null,
        offerType: String(offer.offerType),
        offerAmount:
          offer.offerAmount != null && offer.offerAmount !== undefined
            ? parseFloat(String(offer.offerAmount))
            : null,
        aprRate: aprRate != null && aprRate !== undefined ? parseFloat(String(aprRate)) : null,
        aprTermMonths:
          aprTermMonths != null && aprTermMonths !== undefined
            ? parseInt(String(aprTermMonths), 10)
            : null,
        leaseTermMonths:
          leaseTermMonths != null && leaseTermMonths !== undefined
            ? parseInt(String(leaseTermMonths), 10)
            : null,
        cashValue: cashValue != null && cashValue !== undefined ? parseFloat(String(cashValue)) : null,
        tradeDiscount:
          offer.tradeDiscount != null && offer.tradeDiscount !== undefined
            ? parseFloat(String(offer.tradeDiscount))
            : null,
        leaseDueAtSigning:
          leaseDueAtSigning != null && leaseDueAtSigning !== undefined
            ? parseFloat(String(leaseDueAtSigning))
            : null,
        leaseMonthlyPayment:
          leaseMonthlyPayment != null && leaseMonthlyPayment !== undefined
            ? parseFloat(String(leaseMonthlyPayment))
            : null,
        milesPerYear:
          offer.milesPerYear != null && offer.milesPerYear !== undefined
            ? parseInt(String(offer.milesPerYear), 10)
            : null,
        expirationDate: offer.expirationDate ? new Date(offer.expirationDate) : null,
        terms: offer.terms ? String(offer.terms) : null,
        finePrint: offer.finePrint ? String(offer.finePrint) : null,
        scrapedAt: scrapedAtDate,
        sourceUrl: sourceUrl ? String(sourceUrl) : null,
        loyaltyBonus: offer.loyaltyBonus != null ? parseFloat(String(offer.loyaltyBonus)) : null,
        conquestBonus: offer.conquestBonus != null ? parseFloat(String(offer.conquestBonus)) : null,
        militaryDiscount: offer.militaryDiscount != null ? parseFloat(String(offer.militaryDiscount)) : null,
        collegeGrad: offer.collegeGrad != null ? parseFloat(String(offer.collegeGrad)) : null,
        firstResponder: offer.firstResponder != null ? parseFloat(String(offer.firstResponder)) : null,
      });
    }

    // Always record scrape (event + snapshot) even when no offers are valid
    const usedBrand =
      brand ?? (validOffers[0]?.brand ? String(validOffers[0].brand) : null) ?? "unknown";
    const result = await storeScrapedIncentives({
      brand: usedBrand,
      offers: validOffers,
      source: source ?? null,
      rawPayload: body,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? "Failed to store incentives" },
        { status: 500 },
      );
    }

    if (validOffers.length === 0) {
      return NextResponse.json({
        success: true,
        received: offers.length,
        validated: 0,
        stored: 0,
        brand: usedBrand,
        scrapeEventId: result.scrapeEventId,
        message:
          "No valid offers after validation; scrape event and snapshot recorded for audit.",
      });
    }

    return NextResponse.json({
      success: true,
      received: offers.length,
      validated: validOffers.length,
      stored: result.stored,
      brand: usedBrand,
      scrapeEventId: result.scrapeEventId,
      message: `Successfully stored ${result.stored} incentives${usedBrand ? ` for ${usedBrand}` : ""}`,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("Error processing incentives scrape:", errMessage);
    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 500 },
    );
  }
}
