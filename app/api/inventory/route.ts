import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserDealer } from "@/lib/auth/getUserDealer";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = request.headers.get("x-user-id")!;

    // Get user's dealer
    const dealerId = await getUserDealer(userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    // Get all status values from query params (can be multiple)
    const statusValues = searchParams.getAll("status");
    const makeValues = searchParams.getAll("make");
    const yearValues = searchParams.getAll("year");
    const searchQuery = searchParams.get("search")?.trim() || "";

    // Build where clause
    const where: any = {
      dealerId,
    };

    // Add status filter if provided (support multiple statuses)
    if (statusValues.length > 0) {
      where.status = {
        in: statusValues,
      };
    }

    // Add make filter if provided (support multiple makes)
    if (makeValues.length > 0) {
      where.make = {
        in: makeValues,
      };
    }

    // Add year filter if provided (support multiple years)
    if (yearValues.length > 0) {
      const years = yearValues
        .map((value) => parseInt(value, 10))
        .filter((value) => !isNaN(value));
      if (years.length > 0) {
        where.year = {
          in: years,
        };
      }
    }

    // Add search filter if provided
    if (searchQuery) {
      const searchConditions: any[] = [
        { vin: { contains: searchQuery, mode: "insensitive" as const } },
        { make: { contains: searchQuery, mode: "insensitive" as const } },
        { model: { contains: searchQuery, mode: "insensitive" as const } },
        { trim: { contains: searchQuery, mode: "insensitive" as const } },
      ];

      // If search query is a number, also search by year
      const yearNum = parseInt(searchQuery, 10);
      if (!isNaN(yearNum)) {
        searchConditions.push({ year: yearNum });
      }

      where.OR = searchConditions;
    }

    const [inventory, totalCount] = await Promise.all([
      prisma.inventoryListing.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.inventoryListing.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      inventory,
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
    console.error("Error fetching inventory:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
