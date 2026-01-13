import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserDealer } from "@/lib/auth/getUserDealer";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET full sale data details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get("x-user-id")!;
    const dealerId = await getUserDealer(userId);
    if (!dealerId) {
      return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
    }

    const saleData = await prisma.saleData.findUnique({
      where: { id: params.id, dealerId },
      include: {
        commission: true,
        deal: true,
        dealAuxiliary: true,
        dealEvents: {
          orderBy: { dealEventDate: "asc" },
        },
        fees: {
          orderBy: { orderIndex: "asc" },
        },
        incentives: true,
        insurance: true,
        salesPersons: true,
        tax: true,
        totals: true,
        trades: {
          orderBy: { orderIndex: "asc" },
        },
        vehicle: true,
      },
    });

    if (!saleData) {
      return NextResponse.json({ error: "Sale data not found" }, { status: 404 });
    }

    return NextResponse.json({ saleData });
  } catch (error: any) {
    console.error("Get sale data details error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

