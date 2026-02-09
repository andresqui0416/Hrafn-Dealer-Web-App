import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    await prisma.$connect();

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

    console.log(`Received ${offers.length} offers from ${source || "unknown source"}`);

    // Delete existing offers for the brand from request
    if (brand) {
      const deleteResult = await prisma.offers.deleteMany({
        where: {
          brand: brand,
        },
      });
      console.log(`Deleted ${deleteResult.count} existing ${brand} offers`);
    }

    // Validate offers - Python script should have normalized everything, but do basic validation
    const validOffers: any[] = [];
    // Set scrapedAt timestamp on backend (not from Python script)
    const scrapedAtDate = new Date();

    for (const offer of offers) {
      // Basic validation - Python script should have done full normalization
      if (!offer.brand || !offer.offerType) {
        console.warn("Skipping offer with missing required fields:", {
          brand: offer.brand,
          offerType: offer.offerType,
        });
        continue;
      }

      // Ensure offer has meaningful data
      // Support both old and new field names for backward compatibility during migration
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

      // Store as-is (Python script should have normalized all types)
      // Support both old and new field names for backward compatibility during migration
      const sourceUrl =
        offer.sourceUrl ?? offer.source_url ?? null;
      validOffers.push({
        brand: String(offer.brand),
        year:
          offer.year !== null && offer.year !== undefined ? parseInt(String(offer.year), 10) : null,
        make: offer.make ? String(offer.make) : offer.brand,
        model: offer.model ? String(offer.model) : null,
        modelCode: offer.modelCode ? String(offer.modelCode) : null,
        trim: offer.trim ? String(offer.trim) : null,
        offerType: String(offer.offerType),
        offerAmount:
          offer.offerAmount !== null && offer.offerAmount !== undefined
            ? parseFloat(String(offer.offerAmount))
            : null,
        aprRate: aprRate !== null && aprRate !== undefined ? parseFloat(String(aprRate)) : null,
        aprTermMonths:
          aprTermMonths !== null && aprTermMonths !== undefined
            ? parseInt(String(aprTermMonths), 10)
            : null,
        leaseTermMonths:
          leaseTermMonths !== null && leaseTermMonths !== undefined
            ? parseInt(String(leaseTermMonths), 10)
            : null,
        cashValue:
          cashValue !== null && cashValue !== undefined ? parseFloat(String(cashValue)) : null,
        tradeDiscount:
          offer.tradeDiscount !== null && offer.tradeDiscount !== undefined
            ? parseFloat(String(offer.tradeDiscount))
            : null,
        leaseDueAtSigning:
          leaseDueAtSigning !== null && leaseDueAtSigning !== undefined
            ? parseFloat(String(leaseDueAtSigning))
            : null,
        leaseMonthlyPayment:
          leaseMonthlyPayment !== null && leaseMonthlyPayment !== undefined
            ? parseFloat(String(leaseMonthlyPayment))
            : null,
        milesPerYear:
          offer.milesPerYear !== null && offer.milesPerYear !== undefined
            ? parseInt(String(offer.milesPerYear), 10)
            : null,
        expirationDate: offer.expirationDate ? new Date(offer.expirationDate) : null,
        terms: offer.terms ? String(offer.terms) : null,
        finePrint: offer.finePrint ? String(offer.finePrint) : null,
        scrapedAt: scrapedAtDate,
        sourceUrl: sourceUrl ? String(sourceUrl) : null,
        loyaltyBonus:
          offer.loyaltyBonus != null ? parseFloat(String(offer.loyaltyBonus)) : null,
        conquestBonus:
          offer.conquestBonus != null ? parseFloat(String(offer.conquestBonus)) : null,
        militaryDiscount:
          offer.militaryDiscount != null ? parseFloat(String(offer.militaryDiscount)) : null,
        collegeGrad:
          offer.collegeGrad != null ? parseFloat(String(offer.collegeGrad)) : null,
        firstResponder:
          offer.firstResponder != null ? parseFloat(String(offer.firstResponder)) : null,
      });
    }

    console.log(`Validated ${validOffers.length} offers out of ${offers.length} received`);

    // Store offers in database - process in batches to avoid transaction timeout
    let storedCount = 0;
    if (validOffers.length > 0) {
      const BATCH_SIZE = 10; // Process 10 offers at a time
      for (let i = 0; i < validOffers.length; i += BATCH_SIZE) {
        const batch = validOffers.slice(i, i + BATCH_SIZE);
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
                  scrapedAt: scrapedAtDate,
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
          storedCount += batch.length;
        } catch (err: any) {
          // Log but don't fail on batch errors
          console.error("Error storing offer batch:", err?.message || err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      received: offers.length,
      validated: validOffers.length,
      stored: storedCount,
      brand: brand || null,
      message: `Successfully stored ${storedCount} offers${brand ? ` for ${brand}` : ""}`,
    });
  } catch (error: any) {
    console.error("Error processing offers:", error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal server error while processing offers",
      },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
