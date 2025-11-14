import { NextRequest, NextResponse } from "next/server";
import { getFISalesData } from "@/lib/cdk/CDK Drive Get FI Sales";

export const dynamic = "force-dynamic";

/**
 * GET /api/cdk/saleData/open/delta
 * Retrieves new and changed Vehicle Sale records with status equal to
 * 'C' (cleared), 'B' (booked), 'P' (pending) from the last 48 hours.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const data = await getFISalesData("open/delta", departmentId, startDate, endDate);

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("Error fetching FI Sales open delta data:", error);
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

