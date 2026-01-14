import { NextRequest, NextResponse } from "next/server";
import { getFISalesHistoryData } from "@/lib/cdk/cdkDriveGetFISale";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/**
 * GET /api/cdk/saleData/history
 * Retrieves Historical Vehicle Sale records with status equal to 'F' (finalized)
 * older than 31 days. Date range must be between T-5 years - 31 days and T-31 days.
 * The difference between startDate and endDate should be less than or equal to 6 months.
 *
 * Query parameters:
 * - startDate (required): Start date in ISO 8601 format (yyyy-mm-ddThh:mm:ss)
 * - endDate (optional): End date in ISO 8601 format (defaults to current date - 31 days)
 * - departmentId (optional): Department ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const startDate = searchParams.get("startDate") as string;
    const endDate = searchParams.get("endDate") as string;

    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error:
            "startDate and endDate are required. Format: yyyy-mm-ddThh:mm:ss (e.g., 2023-01-01T10:15:30)",
        },
        { status: 400 },
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        {
          success: false,
          error: "startDate must be before endDate",
        },
        { status: 400 },
      );
    }

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
      return NextResponse.json(
        { error: "Dealer service subscription ID not found" },
        { status: 404 },
      );
    }

    const data = await getFISalesHistoryData(
      departmentId as string,
      dealerDepartment.service.subscriptionId as string,
      startDate as string,
      endDate as string,
    );

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("Error fetching FI Sales history data:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
