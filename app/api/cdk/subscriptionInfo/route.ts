import { NextRequest, NextResponse } from "next/server";
import { getFortellisAccessToken } from "@/lib/cdk/index";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getFortellisAccessToken();

    const response = await fetch("https://subscriptions.fortellis.io/v1/solution/subscriptions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => "Unknown error");
      return NextResponse.json(
        {
          error: "Failed to fetch subscription info",
          details: errorData,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("CDK subscription info error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Internal server error",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
