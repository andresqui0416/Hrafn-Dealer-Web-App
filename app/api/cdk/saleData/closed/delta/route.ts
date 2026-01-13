import { NextRequest, NextResponse } from "next/server";
import { getFISalesData } from "@/lib/cdk/cdkDriveGetFISale";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

/**
 * GET /api/cdk/saleData/closed/delta
 * Retrieves new and changed Vehicle Sale records with status equal to
 * 'C' (cleared), 'B' (booked), 'F' (finalized), 'I' (intermediate) or 'U' (unwound)
 * from the last 48 hours.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const startDate = searchParams.get("startDate") as string || (new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
    const endDate = searchParams.get("endDate") as string || (new Date(Date.now()).toISOString());

    const dealerDepartment = await prisma.dealerDepartment.findUnique({
      where: { id: departmentId as string },
      include: {
        service: {
          select: {
            subscriptionId: true,
          },
        },
      },
    });

    if (!dealerDepartment) {
      return NextResponse.json({ error: "Dealer department not found" }, { status: 404 });
    }

    if (!dealerDepartment.service.subscriptionId) {
      return NextResponse.json({ error: "Dealer service subscription ID not found" }, { status: 404 });
    }

    const data = await getFISalesData("closed/delta", departmentId as string, dealerDepartment.service.subscriptionId as string, startDate as string, endDate as string);

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("Error fetching FI Sales closed delta data:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

