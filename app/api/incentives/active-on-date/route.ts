import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

/**
 * GET /api/incentives/active-on-date
 * Historical reconstruction: "What national incentives were active for OEM X, model Y, on date T?"
 * Query params: oem (required), model (optional), date (optional, default today UTC).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const oem = searchParams.get("oem");
    const model = searchParams.get("model");
    const dateParam = searchParams.get("date");

    if (!oem?.trim()) {
      return NextResponse.json(
        { error: "Query parameter 'oem' is required" },
        { status: 400 },
      );
    }

    const onDate = dateParam ? new Date(dateParam) : new Date();
    if (isNaN(onDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'date' parameter; use ISO 8601 date" },
        { status: 400 },
      );
    }

    // Start and end of the given day in UTC (inclusive)
    const startOfDay = new Date(onDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(onDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Deterministic rule: version was active on T if
    // - effective_from <= endOfDay(T) and (effective_to is null or effective_to > startOfDay(T))
    // - offer was not expired as of T: expiration_date is null or expiration_date >= startOfDay(T)
    const combinedWhere = {
      brand: oem.trim(),
      ...(model?.trim()
        ? { model: { contains: model.trim(), mode: "insensitive" as const } }
        : {}),
      effectiveFrom: { lte: endOfDay },
      AND: [
        {
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: startOfDay } },
          ],
        },
        {
          OR: [
            { expirationDate: null },
            { expirationDate: { gte: startOfDay } },
          ],
        },
      ],
    };

    // Fetch versions active on T. Multiple version rows can match (same logical offer, different versions);
    // we want the latest version that was active on T per (brand, model, year, offerType, ...).
    const versions = await prisma.offerVersion.findMany({
      where: combinedWhere,
      orderBy: [
        { brand: "asc" },
        { model: "asc" },
        { year: "desc" },
        { effectiveFrom: "desc" },
      ],
    });

    // Dedupe to latest version per logical offer (brand + model + year + offerType + trim/key fields)
    const seen = new Set<string>();
    const latest: typeof versions = [];
    for (const v of versions) {
      const key = [v.brand, v.model, v.year, v.offerType, v.trim].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      latest.push(v);
    }

    // Map to API shape (match current incentive response)
    type VersionRow = (typeof latest)[number];
    const incentives = latest.map((v: VersionRow) => ({
      id: v.id,
      brand: v.brand,
      year: v.year,
      make: v.make,
      model: v.model,
      modelCode: v.modelCode,
      trim: v.trim,
      offerType: v.offerType,
      offerAmount: v.offerAmount,
      aprRate: v.aprRate,
      leaseTermMonths: v.leaseTermMonths,
      aprTermMonths: v.aprTermMonths,
      cashValue: v.cashValue,
      tradeDiscount: v.tradeDiscount,
      leaseDueAtSigning: v.leaseDueAtSigning,
      leaseMonthlyPayment: v.leaseMonthlyPayment,
      milesPerYear: v.milesPerYear,
      expirationDate: v.expirationDate,
      terms: v.terms,
      finePrint: v.finePrint,
      scrapedAt: v.scrapedAt,
      sourceUrl: v.sourceUrl,
      loyaltyBonus: v.loyaltyBonus,
      conquestBonus: v.conquestBonus,
      militaryDiscount: v.militaryDiscount,
      collegeGrad: v.collegeGrad,
      firstResponder: v.firstResponder,
      version: v.version,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
    }));

    return NextResponse.json({
      incentives,
      query: { oem: oem.trim(), model: model?.trim() ?? null, onDate: onDate.toISOString().slice(0, 10) },
    });
  } catch (error) {
    console.error("Error fetching incentives active on date:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
