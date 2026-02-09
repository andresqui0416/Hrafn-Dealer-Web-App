import type { Prisma } from "@prisma/client";

/**
 * Build Prisma where clause for incentives (Offers table).
 * Freshness: EXPIRED = past expirationDate; UNVERIFIED = scraped_at > 7 days ago.
 */
export function buildIncentivesWhere(options: {
  includeExpired?: boolean;
  includeUnverified?: boolean;
  brands?: string[];
  oem?: string;
  year?: string;
  model?: string;
  offerTypes?: string[];
  searchQuery?: string | null;
}): Prisma.OffersWhereInput {
  const where: Prisma.OffersWhereInput = {};

  if (!options.includeExpired) {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    where.OR = [
      { expirationDate: null },
      { expirationDate: { gte: startOfToday } },
    ];
  }
  if (!options.includeUnverified) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    where.scrapedAt = { gte: sevenDaysAgo };
  }

  if (options.oem) {
    where.brand = options.oem;
  } else if (options.brands && options.brands.length > 0) {
    where.brand = { in: options.brands };
  }
  if (options.year) {
    where.year = parseInt(options.year, 10);
  }
  if (options.model) {
    where.model = {
      contains: options.model,
      mode: "insensitive",
    };
  }
  if (options.offerTypes && options.offerTypes.length > 0) {
    where.offerType = { in: options.offerTypes };
  }
  if (options.searchQuery) {
    const searchCondition: Prisma.OffersWhereInput = {
      OR: [
        { brand: { contains: options.searchQuery, mode: "insensitive" } },
        { model: { contains: options.searchQuery, mode: "insensitive" } },
        { make: { contains: options.searchQuery, mode: "insensitive" } },
        { terms: { contains: options.searchQuery, mode: "insensitive" } },
      ],
    };
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), searchCondition];
  }

  return where;
}

export const defaultOrderBy = [
  { brand: "asc" as const },
  { model: "asc" as const },
  { year: "desc" as const },
  { expirationDate: "asc" as const },
  { scrapedAt: "desc" as const },
];
