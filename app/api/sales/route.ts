import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserDealer } from "@/lib/auth/getUserDealer";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET sales data with pagination and search (table fields only)
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id")!;
    const dealerId = await getUserDealer(userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = { dealerId };
    if (search) {
      where.OR = [
        { dealNo: { contains: search, mode: "insensitive" as const } },
        {
          vehicle: {
            OR: [
              { vin: { contains: search, mode: "insensitive" as const } },
              { make: { contains: search, mode: "insensitive" as const } },
              { model: { contains: search, mode: "insensitive" as const } },
              { makeName: { contains: search, mode: "insensitive" as const } },
              { modelName: { contains: search, mode: "insensitive" as const } },
            ],
          },
        },
      ];
    }

    // Get sales data with only fields needed for table
    const [salesData, totalCount] = await prisma.$transaction([
      prisma.saleData.findMany({
        where,
        select: {
          id: true,
          dealNo: true,
          status: true,
          dealStatusDate: true,
          changedDate: true,
          createdAt: true,
          vehicle: {
            select: {
              vin: true,
              make: true,
              makeName: true,
              model: true,
              modelName: true,
              year: true,
              color: true,
              stockNo: true,
            },
          },
          deal: {
            select: {
              contractDate: true,
              salesDate: true,
              cashPrice: true,
              grossProfit: true,
              saleType: true,
            },
          },
        },
        orderBy: { dealStatusDate: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.saleData.count({ where }),
    ]);

    return NextResponse.json({
      salesData,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error: any) {
    console.error("Get sales data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
