import { Prisma, type Offers } from "@prisma/client";
import { prisma } from "../prisma";

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
  version?: number | null;
};

/** Prisma `Decimal` / create-input unions → plain number (null-safe; 0 is preserved). */
function prismaDecimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object" && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return null;
}

/** Normalize a number to fixed DB scale so tiny source float noise does not bump versions. */
function normalizeDecimalAtScale(v: unknown, scale: number): number | null {
  const n = prismaDecimalToNumber(v);
  if (n == null) return null;
  return Number(n.toFixed(scale));
}

/** Map a row read back from `Offers` into the normalized shape used for `offer_versions`. */
function prismaOfferRowToNormalized(row: Offers): NormalizedIncentiveOffer {
  return {
    brand: row.brand,
    year: row.year,
    make: row.make,
    model: row.model,
    modelCode: row.modelCode,
    trim: row.trim,
    offerType: row.offerType,
    offerAmount: prismaDecimalToNumber(row.offerAmount),
    aprRate: prismaDecimalToNumber(row.aprRate),
    leaseTermMonths: row.leaseTermMonths,
    aprTermMonths: row.aprTermMonths,
    cashValue: prismaDecimalToNumber(row.cashValue),
    tradeDiscount: prismaDecimalToNumber(row.tradeDiscount),
    leaseDueAtSigning: prismaDecimalToNumber(row.leaseDueAtSigning),
    leaseMonthlyPayment: prismaDecimalToNumber(row.leaseMonthlyPayment),
    milesPerYear: row.milesPerYear,
    expirationDate: row.expirationDate,
    terms: row.terms,
    finePrint: row.finePrint,
    scrapedAt: row.scrapedAt,
    sourceUrl: row.sourceUrl,
    loyaltyBonus: prismaDecimalToNumber(row.loyaltyBonus),
    conquestBonus: prismaDecimalToNumber(row.conquestBonus),
    militaryDiscount: prismaDecimalToNumber(row.militaryDiscount),
    collegeGrad: prismaDecimalToNumber(row.collegeGrad),
    firstResponder: prismaDecimalToNumber(row.firstResponder),
    version: row.version,
  };
}

/**
 * Calendar day in UTC as `YYYY-MM-DD` (aligns with `@db.Date`: time-of-day must not force a version bump).
 */
function expirationCalendarKeyUtc(d: Date | null | undefined): string | null {
  if (d == null) return null;
  const t = d instanceof Date ? d.getTime() : new Date(d as string | number).getTime();
  if (Number.isNaN(t)) return null;
  const x = new Date(t);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when any user-visible offer terms differ from what is already stored (bump `Offers.version`). */
function persistedOfferTermsChanged(
  existing: Offers,
  incoming: Prisma.OffersUncheckedCreateInput,
): boolean {
  const changed = (
    normalizeDecimalAtScale(existing.offerAmount, 2) !== normalizeDecimalAtScale(incoming.offerAmount, 2) ||
    normalizeDecimalAtScale(existing.aprRate, 4) !== normalizeDecimalAtScale(incoming.aprRate, 4) ||
    existing.leaseTermMonths !== incoming.leaseTermMonths ||
    existing.aprTermMonths !== incoming.aprTermMonths ||
    normalizeDecimalAtScale(existing.cashValue, 2) !== normalizeDecimalAtScale(incoming.cashValue, 2) ||
    normalizeDecimalAtScale(existing.tradeDiscount, 2) !== normalizeDecimalAtScale(incoming.tradeDiscount, 2) ||
    normalizeDecimalAtScale(existing.leaseDueAtSigning, 2) !==
    normalizeDecimalAtScale(incoming.leaseDueAtSigning, 2) ||
    normalizeDecimalAtScale(existing.leaseMonthlyPayment, 2) !==
    normalizeDecimalAtScale(incoming.leaseMonthlyPayment, 2) ||
    existing.milesPerYear !== incoming.milesPerYear ||
    expirationCalendarKeyUtc(existing.expirationDate) !==
    expirationCalendarKeyUtc(incoming.expirationDate as Date | null | undefined) ||
    existing.terms !== incoming.terms ||
    existing.finePrint !== incoming.finePrint ||
    normalizeDecimalAtScale(existing.loyaltyBonus, 2) !== normalizeDecimalAtScale(incoming.loyaltyBonus, 2) ||
    normalizeDecimalAtScale(existing.conquestBonus, 2) !== normalizeDecimalAtScale(incoming.conquestBonus, 2) ||
    normalizeDecimalAtScale(existing.militaryDiscount, 2) !== normalizeDecimalAtScale(incoming.militaryDiscount, 2) ||
    normalizeDecimalAtScale(existing.collegeGrad, 2) !== normalizeDecimalAtScale(incoming.collegeGrad, 2) ||
    normalizeDecimalAtScale(existing.firstResponder, 2) !== normalizeDecimalAtScale(incoming.firstResponder, 2) ||
    existing.sourceUrl !== incoming.sourceUrl
  );
  changed && console.log("persistedOfferTermsChanged", changed, existing, incoming);
  return changed;
}

/** Columns written to `Offers` from a normalized scrape row (no `id` / Prisma-managed fields). */
function normalizedOfferToOffersWriteData(
  o: NormalizedIncentiveOffer & { scrapedAt: Date },
): Prisma.OffersUncheckedCreateInput {
  return {
    brand: o.brand,
    year: toIntOrNull(o.year),
    make: o.make ?? null,
    model: o.model ?? null,
    modelCode: o.modelCode ?? null,
    trim: o.trim ?? null,
    offerType: o.offerType,
    offerAmount: o.offerAmount ?? null,
    aprRate: o.aprRate ?? null,
    leaseTermMonths: toIntOrNull(o.leaseTermMonths),
    aprTermMonths: toIntOrNull(o.aprTermMonths),
    cashValue: o.cashValue ?? null,
    tradeDiscount: o.tradeDiscount ?? null,
    leaseDueAtSigning: o.leaseDueAtSigning ?? null,
    leaseMonthlyPayment: o.leaseMonthlyPayment ?? null,
    milesPerYear: toIntOrNull(o.milesPerYear),
    expirationDate: o.expirationDate ?? null,
    terms: o.terms ?? null,
    finePrint: o.finePrint ?? null,
    scrapedAt: o.scrapedAt,
    sourceUrl: o.sourceUrl ?? null,
    loyaltyBonus: o.loyaltyBonus ?? null,
    conquestBonus: o.conquestBonus ?? null,
    militaryDiscount: o.militaryDiscount ?? null,
    collegeGrad: o.collegeGrad ?? null,
    firstResponder: o.firstResponder ?? null,
    version: o.version ?? 1,
  };
}

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
    version: offer.version ?? 1,
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
 * Create a ScrapeEvent when scraping starts for a platform. Call this at the beginning of each
 * scraper (e.g. scrapeOffersFromAudi) so the event reflects "scrape started" time.
 * Then pass the returned scrapeEventId to storeScrapedIncentives when storing results.
 */
export async function createScrapeEvent(params: {
  brand: string;
  source?: string | null;
}): Promise<{ scrapeEventId: string }> {
  const event = await prisma.scrapeEvent.create({
    data: {
      source: params.source ?? null,
      brand: params.brand,
      status: "running",
    },
  });
  return { scrapeEventId: event.id };
}

/**
 * Mark an existing ScrapeEvent as failed and write a failure log. Call from scrapers when
 * scraping or processing fails after createScrapeEvent was called.
 */
export async function markScrapeEventFailed(
  scrapeEventId: string,
  errorMessage: string,
  options?: { brand?: string | null; source?: string | null },
): Promise<void> {
  try {
    await prisma.scrapeEvent.update({
      where: { id: scrapeEventId },
      data: {
        completedAt: new Date(),
        status: "failure",
        errorMessage,
      },
    });
    await prisma.scrapeFailureLog.create({
      data: {
        scrapeEventId,
        brand: options?.brand ?? null,
        source: options?.source ?? null,
        failureType: "scrape_failure",
        message: errorMessage,
      },
    });
  } catch (err) {
    console.error("[markScrapeEventFailed]", err);
  }
}

/**
 * Store scraped incentives with full auditability: ScrapeEvent, raw Snapshot, version lineage.
 * Call from cron (lib/offers) or from POST /api/incentives/scrape.
 * If scrapeEventId is provided (from createScrapeEvent at scrape start), that event is updated
 * instead of creating a new one.
 */
export async function storeScrapedIncentives(params: {
  brand: string;
  offers: NormalizedIncentiveOffer[];
  source?: string | null;
  rawPayload?: object; // optional override for snapshot (defaults to { offers, source, brand })
  scrapeEventId?: string | null; // optional: use event created at scrape start
}): Promise<StoreScrapedIncentivesResult> {
  const { brand, offers, source = null, rawPayload, scrapeEventId: existingEventId } = params;
  const scrapedAtDate = new Date();
  let scrapeEventId: string | null = null;

  try {
    let event: { id: string };
    if (existingEventId) {
      const existing = await prisma.scrapeEvent.findFirst({
        where: { id: existingEventId },
        orderBy: { startedAt: "desc" },
      });
      if (!existing || existing.status !== "running") {
        throw new Error(
          `ScrapeEvent ${existingEventId} not found or not running (status: ${existing?.status ?? "n/a"})`,
        );
      }
      event = { id: existing.id };
      scrapeEventId = existing.id;
    } else {
      const created = await prisma.scrapeEvent.create({
        data: {
          source,
          brand,
          status: "running",
        },
      });
      event = created;
      scrapeEventId = created.id;
    }

    let recordsReplaced = 0;
    let recordsInserted = 0;

    let storedCount = 0;
    const offersWithDate = offers.map((o) => ({ ...o, scrapedAt: o.scrapedAt ?? scrapedAtDate }));

    await prisma.$transaction(
      async (tx) => {
        for (const o of offersWithDate) {
          const data = normalizedOfferToOffersWriteData(o);
          const matchWhere: Prisma.OffersWhereInput = {
            brand: data.brand,
            modelCode: data.modelCode,
            model: data.model,
            offerType: data.offerType,
            trim: data.trim,
            year: data.year,
          };
          const existing = await tx.offers.findFirst({ where: matchWhere, orderBy: { createdAt: "desc" } });
          let persisted: Offers;
          if (existing) {
            const changed = persistedOfferTermsChanged(existing, data);
            if (changed) {
              persisted = await tx.offers.update({
                where: { id: existing.id },
                data: { ...data, version: existing.version + 1 },
              });
              recordsReplaced++;
            } else {
              persisted = existing;
            }
          } else {
            persisted = await tx.offers.create({ data });
            recordsInserted++;
          }

          const offerForVersion = prismaOfferRowToNormalized(persisted);
          await tx.offerVersion.create({
            data: mapOfferToVersionRow(offerForVersion, event.id, o.scrapedAt ?? scrapedAtDate, null),
          });
          storedCount++;
        }

        await tx.scrapeSnapshot.create({
          data: {
            scrapeEventId: event.id,
            rawPayload: rawPayload ?? { offers, source, brand },
          },
        });
      },
      {
        maxWait: 15_000,
        timeout: 600_000,
      },
    );

    await prisma.scrapeEvent.update({
      where: { id: event.id },
      data: {
        completedAt: new Date(),
        status: "success",
        recordsInserted,
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
    // Mark event as failure if we created one (any failure from start through complete storing).
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
      } catch (updateErr) {
        console.error("[storeScrapedIncentives] Failed to update ScrapeEvent to failure:", updateErr);
      }
    }
    // Always record failure log for any failed step (event create, snapshot, offers, etc.).
    try {
      await prisma.scrapeFailureLog.create({
        data: {
          scrapeEventId: scrapeEventId ?? undefined,
          brand: brand ?? null,
          source: source ?? null,
          failureType: "scrape_failure",
          message: errorMessage,
        },
      });
    } catch (logErr) {
      console.error("[storeScrapedIncentives] Failed to write ScrapeFailureLog:", logErr);
    }
    return {
      success: false,
      stored: 0,
      recordsReplaced: 0,
      scrapeEventId: scrapeEventId ?? "",
      error: errorMessage,
    };
  }
}
