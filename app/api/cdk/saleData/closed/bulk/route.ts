import { NextRequest, NextResponse } from "next/server";
import { getFISalesData } from "@/lib/cdk/cdkDriveGetFISale";

export const dynamic = "force-dynamic";

/**
 * GET /api/cdk/saleData/closed/bulk
 * Retrieves Vehicle Sale records for the last 31 days with status equal to
 * 'C' (cleared), 'B' (booked), 'F' (finalized), 'I' (intermediate) or 'U' (unwound).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const data = await getFISalesData("closed", departmentId, startDate, endDate);

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("Error fetching FI Sales closed bulk data:", error);
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

