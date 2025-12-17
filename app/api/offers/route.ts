import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    // Get filters from query params
    const brand = searchParams.get("brand");
    const year = searchParams.get("year");
    const model = searchParams.get("model");
    const offerTypes = searchParams.getAll("offerType"); // Get all offerType values
    const searchQuery = searchParams.get("search");

    // Build where clause
    const where: any = {};

    // Add filters
    if (brand) {
      where.brand = brand;
    }
    if (year) {
      where.year = parseInt(year, 10);
    }
    if (model) {
      where.model = {
        contains: model,
        mode: "insensitive",
      };
    }
    if (offerTypes.length > 0) {
      where.offerType = {
        in: offerTypes,
      };
    }
    if (searchQuery) {
      where.OR = [
        { brand: { contains: searchQuery, mode: "insensitive" } },
        { model: { contains: searchQuery, mode: "insensitive" } },
        { make: { contains: searchQuery, mode: "insensitive" } },
        { terms: { contains: searchQuery, mode: "insensitive" } },
      ];
    }

    const [offers, totalCount] = await Promise.all([
      prisma.offers.findMany({
        where,
        orderBy: [
          { brand: "asc" },
          { model: "asc" },
          { year: "desc" },
          { expirationDate: "asc" }, // Show expiring soon first
          { scrapedAt: "desc" }, // Then most recently scraped
        ],
        skip,
        take: limit,
      }),
      prisma.offers.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      offers,
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
    console.error("Error fetching offers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
