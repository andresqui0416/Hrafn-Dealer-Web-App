import { NextRequest, NextResponse } from "next/server";
import { getFortellisAccessToken } from "@/lib/cdk/index";
import { logFortellisApiCall } from "@/lib/cdk/fortellisLogger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getFortellisAccessToken();

    const url = "https://subscriptions.fortellis.io/v1/solution/subscriptions";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const responseClone = response.clone();
    const responseText = await responseClone.text().catch(() => null);

    await logFortellisApiCall({
      requestId: undefined,
      method: "GET",
      url,
      requestHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
      requestBody: null,
      responseStatus: response.status,
      responseHeaders: response.headers,
      responseBody: responseText,
    });

    if (!response.ok) {
      const errorData = responseText ?? (await response.text().catch(() => "Unknown error"));
      return NextResponse.json(
        {
          error: "Failed to fetch subscription info",
          details: errorData,
        },
        { status: response.status },
      );
    }

    const data = responseText ? JSON.parse(responseText) : await response.json();
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
