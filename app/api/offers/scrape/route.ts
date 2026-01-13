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
        { status: 400 }
      );
    }

    if (offers.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid request: 'offers' array is empty" },
        { status: 400 }
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
      const hasValidData =
        (offer.offerType === "lease" && offer.monthlyPayment) ||
        (offer.offerType === "financing" && offer.apr !== null) ||
        (offer.offerType === "cash" &&
          (offer.offerAmount !== null ||
            offer.cashBack !== null ||
            offer.tradeDiscount !== null));

      if (!hasValidData) {
        console.warn(
          `Skipping ${offer.offerType} offer for ${offer.model} ${offer.year} - insufficient data`
        );
        continue;
      }

      // Store as-is (Python script should have normalized all types)
      validOffers.push({
        brand: String(offer.brand),
        year: offer.year !== null && offer.year !== undefined ? parseInt(String(offer.year), 10) : null,
        make: offer.make ? String(offer.make) : offer.brand,
        model: offer.model ? String(offer.model) : null,
        modelCode: offer.modelCode ? String(offer.modelCode) : null,
        trim: offer.trim ? String(offer.trim) : null,
        offerType: String(offer.offerType),
        offerAmount: offer.offerAmount !== null && offer.offerAmount !== undefined
          ? parseFloat(String(offer.offerAmount))
          : null,
        apr: offer.apr !== null && offer.apr !== undefined
          ? parseFloat(String(offer.apr))
          : null,
        termMonths: offer.termMonths !== null && offer.termMonths !== undefined
          ? parseInt(String(offer.termMonths), 10)
          : null,
        cashBack: offer.cashBack !== null && offer.cashBack !== undefined
          ? parseFloat(String(offer.cashBack))
          : null,
        tradeDiscount:
          offer.tradeDiscount !== null && offer.tradeDiscount !== undefined
            ? parseFloat(String(offer.tradeDiscount))
            : null,
        dueAtSigning: offer.dueAtSigning !== null && offer.dueAtSigning !== undefined
          ? parseFloat(String(offer.dueAtSigning))
          : null,
        monthlyPayment: offer.monthlyPayment !== null && offer.monthlyPayment !== undefined
          ? parseFloat(String(offer.monthlyPayment))
          : null,
        milesPerYear: offer.milesPerYear !== null && offer.milesPerYear !== undefined
          ? parseInt(String(offer.milesPerYear), 10)
          : null,
        expirationDate: offer.expirationDate
          ? new Date(offer.expirationDate)
          : null,
        terms: offer.terms ? String(offer.terms) : null,
        finePrint: offer.finePrint ? String(offer.finePrint) : null,
        scrapedAt: scrapedAtDate,
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
                  scrapedAt: scrapedAtDate,
                })),
                skipDuplicates: true, // Skip duplicates if any
              });
            },
            {
              maxWait: 10000, // Maximum time to wait for a transaction slot
              timeout: 30000, // Maximum time the transaction can run (30 seconds)
            }
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
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

