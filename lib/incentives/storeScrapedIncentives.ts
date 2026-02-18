import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Convert Prisma Decimal or number to number | null for NormalizedIncentiveOffer. */
function toNumberOrNull(
  v: { toNumber?: () => number } | number | null | undefined,
): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof (v as { toNumber?: () => number }).toNumber === "function")
    return (v as { toNumber: () => number }).toNumber();
  return null;
}

/** Coerce value to Int for Prisma (year, aprTermMonths, leaseTermMonths, milesPerYear). */
function toIntOrNull(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isInteger(v) ? v : Math.floor(v);
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

/** Normalized offer shape for storage (Offers table + version lineage). */
export type NormalizedIncentiveOffer = {
  brand: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  modelCode?: string | null;
  trim?: string | null;
  offerType: string;
  offerAmount?: number | null;
  aprRate?: number | null;
  aprTermMonths?: number | null;
  leaseTermMonths?: number | null;
  cashValue?: number | null;
  tradeDiscount?: number | null;
  leaseDueAtSigning?: number | null;
  leaseMonthlyPayment?: number | null;
  milesPerYear?: number | null;
  expirationDate?: Date | null;
  terms?: string | null;
  finePrint?: string | null;
  scrapedAt?: Date;
  sourceUrl?: string | null;
  loyaltyBonus?: number | null;
  conquestBonus?: number | null;
  militaryDiscount?: number | null;
  collegeGrad?: number | null;
  firstResponder?: number | null;
};

function mapOfferToVersionRow(
  offer: NormalizedIncentiveOffer,
  scrapeEventId: string,
  effectiveFrom: Date,
  effectiveTo: Date | null,
) {
  const scrapedAt = offer.scrapedAt ?? effectiveFrom;
  return {
    scrapeEventId,
    brand: offer.brand,
    year: toIntOrNull(offer.year),
    make: offer.make ?? null,
    model: offer.model ?? null,
    modelCode: offer.modelCode ?? null,
    trim: offer.trim ?? null,
    offerType: offer.offerType,
    offerAmount: offer.offerAmount ?? null,
    aprRate: offer.aprRate ?? null,
    leaseTermMonths: toIntOrNull(offer.leaseTermMonths),
    aprTermMonths: toIntOrNull(offer.aprTermMonths),
    cashValue: offer.cashValue ?? null,
    tradeDiscount: offer.tradeDiscount ?? null,
    leaseDueAtSigning: offer.leaseDueAtSigning ?? null,
    leaseMonthlyPayment: offer.leaseMonthlyPayment ?? null,
    milesPerYear: toIntOrNull(offer.milesPerYear),
    expirationDate: offer.expirationDate ?? null,
    terms: offer.terms ?? null,
    finePrint: offer.finePrint ?? null,
    scrapedAt,
    sourceUrl: offer.sourceUrl ?? null,
    loyaltyBonus: offer.loyaltyBonus ?? null,
    conquestBonus: offer.conquestBonus ?? null,
    militaryDiscount: offer.militaryDiscount ?? null,
    collegeGrad: offer.collegeGrad ?? null,
    firstResponder: offer.firstResponder ?? null,
    version: 1,
    effectiveFrom,
    effectiveTo,
  };
}

export type StoreScrapedIncentivesResult = {
  success: boolean;
  stored: number;
  recordsReplaced: number;
  scrapeEventId: string;
  error?: string;
};

/**
 * Store scraped incentives with full auditability: ScrapeEvent, raw Snapshot, version lineage.
 * Call from cron (lib/offers) or from POST /api/incentives/scrape.
 */
export async function storeScrapedIncentives(params: {
  brand: string;
  offers: NormalizedIncentiveOffer[];
  source?: string | null;
  rawPayload?: object; // optional override for snapshot (defaults to { offers, source, brand })
}): Promise<StoreScrapedIncentivesResult> {
  const { brand, offers, source = null, rawPayload } = params;
  const scrapedAtDate = new Date();
  let scrapeEventId: string | null = null;

  try {
    await prisma.$connect();

    const event = await prisma.scrapeEvent.create({
      data: {
        source,
        brand,
        status: "running",
      },
    });
    scrapeEventId = event.id;

    await prisma.scrapeSnapshot.create({
      data: {
        scrapeEventId: event.id,
        rawPayload: rawPayload ?? { offers, source, brand },
      },
    });

    let recordsReplaced = 0;
    const currentOffers = await prisma.offers.findMany({ where: { brand } });
    recordsReplaced = currentOffers.length;

    if (currentOffers.length > 0) {
      const now = new Date();
      await prisma.offerVersion.createMany({
        data: currentOffers.map((row) =>
          mapOfferToVersionRow(
            {
              brand: row.brand,
              year: row.year,
              make: row.make,
              model: row.model,
              modelCode: row.modelCode,
              trim: row.trim,
              offerType: row.offerType,
              offerAmount: toNumberOrNull(row.offerAmount),
              aprRate: toNumberOrNull(row.aprRate),
              aprTermMonths: row.aprTermMonths,
              leaseTermMonths: row.leaseTermMonths,
              cashValue: toNumberOrNull(row.cashValue),
              tradeDiscount: toNumberOrNull(row.tradeDiscount),
              leaseDueAtSigning: toNumberOrNull(row.leaseDueAtSigning),
              leaseMonthlyPayment: toNumberOrNull(row.leaseMonthlyPayment),
              milesPerYear: row.milesPerYear,
              expirationDate: row.expirationDate,
              terms: row.terms,
              finePrint: row.finePrint,
              scrapedAt: row.scrapedAt,
              sourceUrl: row.sourceUrl,
              loyaltyBonus: toNumberOrNull(row.loyaltyBonus),
              conquestBonus: toNumberOrNull(row.conquestBonus),
              militaryDiscount: toNumberOrNull(row.militaryDiscount),
              collegeGrad: toNumberOrNull(row.collegeGrad),
              firstResponder: toNumberOrNull(row.firstResponder),
            },
            event.id,
            row.scrapedAt,
            now,
          ),
        ),
      });
    }

    await prisma.offers.deleteMany({ where: { brand } });

    const BATCH_SIZE = 10;
    let storedCount = 0;
    const offersWithDate = offers.map((o) => ({ ...o, scrapedAt: o.scrapedAt ?? scrapedAtDate }));

    for (let i = 0; i < offersWithDate.length; i += BATCH_SIZE) {
      const batch = offersWithDate.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(async (tx) => {
        await tx.offers.createMany({
          data: batch.map((o) => ({
            brand: o.brand,
            year: toIntOrNull(o.year),
            make: o.make ?? null,
            model: o.model ?? null,
            modelCode: o.modelCode ?? null,
            trim: o.trim ?? null,
            offerType: o.offerType,
            offerAmount: o.offerAmount ?? null,
            aprRate: o.aprRate ?? null,
            aprTermMonths: toIntOrNull(o.aprTermMonths),
            leaseTermMonths: toIntOrNull(o.leaseTermMonths),
            cashValue: o.cashValue ?? null,
            tradeDiscount: o.tradeDiscount ?? null,
            leaseDueAtSigning: o.leaseDueAtSigning ?? null,
            leaseMonthlyPayment: o.leaseMonthlyPayment ?? null,
            milesPerYear: toIntOrNull(o.milesPerYear),
            terms: o.terms ?? null,
            finePrint: o.finePrint ?? null,
            expirationDate: o.expirationDate ?? null,
            scrapedAt: o.scrapedAt ?? scrapedAtDate,
            sourceUrl: o.sourceUrl ?? null,
            loyaltyBonus: o.loyaltyBonus ?? null,
            conquestBonus: o.conquestBonus ?? null,
            militaryDiscount: o.militaryDiscount ?? null,
            collegeGrad: o.collegeGrad ?? null,
            firstResponder: o.firstResponder ?? null,
          })),
          skipDuplicates: true,
        });
        await tx.offerVersion.createMany({
          data: batch.map((o) =>
            mapOfferToVersionRow(o, event.id, o.scrapedAt ?? scrapedAtDate, null),
          ),
        });
      });
      storedCount += batch.length;
    }

    await prisma.scrapeEvent.update({
      where: { id: event.id },
      data: {
        completedAt: new Date(),
        status: "success",
        recordsInserted: storedCount,
        recordsReplaced,
        recordsFailed: 0,
      },
    });

    return {
      success: true,
      stored: storedCount,
      recordsReplaced,
      scrapeEventId: event.id,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (scrapeEventId) {
      try {
        await prisma.scrapeEvent.update({
          where: { id: scrapeEventId },
          data: {
            completedAt: new Date(),
            status: "failure",
            errorMessage: errorMessage,
          },
        });
      } catch (_) {}
    }
    return {
      success: false,
      stored: 0,
      recordsReplaced: 0,
      scrapeEventId: scrapeEventId ?? "",
      error: errorMessage,
    };
  } finally {
    await prisma.$disconnect();
  }
}
