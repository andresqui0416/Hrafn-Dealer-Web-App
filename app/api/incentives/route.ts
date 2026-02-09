import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { buildIncentivesWhere, defaultOrderBy } from "@/lib/incentives/filters";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

/**
 * GET /api/incentives
 * List incentives with optional freshness (includeExpired, includeUnverified) and filters.
 * Default: exclude expired and unverified (same as /api/incentives/active).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;
    const brands = searchParams.getAll("brand").filter(Boolean);
    const year = searchParams.get("year");
    const model = searchParams.get("model");
    const offerTypes = searchParams.getAll("offerType");
    const searchQuery = searchParams.get("search");
    const includeExpired = searchParams.get("includeExpired") === "true";
    const includeUnverified = searchParams.get("includeUnverified") === "true";

    const where = buildIncentivesWhere({
      includeExpired,
      includeUnverified,
      brands: brands.length ? brands : undefined,
      year: year ?? undefined,
      model: model ?? undefined,
      offerTypes: offerTypes.length ? offerTypes : undefined,
      searchQuery: searchQuery || undefined,
    });

    const [incentives, totalCount] = await Promise.all([
      prisma.offers.findMany({
        where,
        orderBy: defaultOrderBy,
        skip,
        take: limit,
      }),
      prisma.offers.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      incentives,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching incentives:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
