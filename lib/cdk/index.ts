import { PrismaClient } from "@prisma/client";
import { logFortellisApiCall } from "./fortellisLogger";

const prisma = new PrismaClient();

const FORTELLIS_TOKEN_ID = "fortellis-token";
const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Get Fortellis OAuth2 access token
 * Uses client credentials flow and stores the token in database to persist across serverless invocations
 * Refreshes proactively if token expires within 5 minutes
 */
export async function getFortellisAccessToken(forceRefresh: boolean = false): Promise<string> {
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + FIVE_MINUTES_MS);

  // Check if we have a valid token in database (unless forcing refresh)
  if (!forceRefresh) {
    try {
      const tokenRecord = await prisma.crmApiAccessToken.findUnique({
        where: { id: FORTELLIS_TOKEN_ID },
      });

      if (tokenRecord && tokenRecord.expiresAt > fiveMinutesFromNow) {
        console.log(
          `Using cached Fortellis token (expires at: ${tokenRecord.expiresAt.toISOString()})`,
        );
        return tokenRecord.accessToken;
      }

      // Token exists but expires soon or is expired
      if (tokenRecord && tokenRecord.expiresAt <= fiveMinutesFromNow) {
        console.log(
          `Cached token expires soon or expired (expires at: ${tokenRecord.expiresAt.toISOString()}), refreshing...`,
        );
      }
    } catch (error) {
      console.error("Error reading token from database:", error);
      // Continue to fetch new token
    }
  }

  // Fetch new token from Fortellis
  const clientId = process.env.FORTELLIS_CLIENT_ID;
  const clientSecret = process.env.FORTELLIS_CLIENT_SECRET;
  const scope = process.env.FORTELLIS_SCOPE || "anonymous";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Fortellis credentials not configured (FORTELLIS_CLIENT_ID and FORTELLIS_CLIENT_SECRET required)",
    );
  }

  // Prepare form data
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", scope);

  try {
    const response = await fetch("https://identity.fortellis.io/oauth2/v1/token", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Fortellis token request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();

    if (!data.access_token) {
      throw new Error("No access_token in Fortellis response");
    }

    // Trim the token to ensure no whitespace issues
    const trimmedToken = data.access_token.trim();
    if (!trimmedToken) {
      throw new Error("Access token is empty after trimming");
    }

    const expiresInSeconds = data.expires_in || 3600;
    const expiresInMs = expiresInSeconds * 1000 - 60000; // Subtract 60 seconds buffer
    const expiresAt = new Date(now.getTime() + expiresInMs);

    // Store token in database (upsert to handle both create and update)
    await prisma.crmApiAccessToken.upsert({
      where: { id: FORTELLIS_TOKEN_ID },
      update: {
        accessToken: trimmedToken,
        expiresAt: expiresAt,
      },
      create: {
        id: FORTELLIS_TOKEN_ID,
        accessToken: trimmedToken,
        expiresAt: expiresAt,
      },
    });

    console.log(
      `Successfully obtained and stored Fortellis access token (expires at: ${expiresAt.toISOString()})`,
    );
    return trimmedToken;
  } catch (error) {
    console.error("Error getting Fortellis access token:", error);
    throw error;
  }
}

/**
 * Clear the Fortellis token from database
 * Useful when token is known to be invalid
 */
export async function clearTokenCache(): Promise<void> {
  try {
    await prisma.crmApiAccessToken.delete({
      where: { id: FORTELLIS_TOKEN_ID },
    });
    console.log("Fortellis token cleared from database");
  } catch (error) {
    // Token might not exist, which is fine
    if ((error as any)?.code !== "P2025") {
      // P2025 is "Record not found" error
      console.error("Error clearing token from database:", error);
    }
  }
}

/**
 * Fetch subscription and department info from Fortellis
 * Finds active subscriptions with FI Sales APIs and extracts subscription/department IDs
 */
export async function getFortellisSubscriptionInfo(
  accessToken: string,
  dealerId?: string,
): Promise<{ subscriptionId: string; departmentId: string }> {
  try {
    const url = "https://subscriptions.fortellis.io/v1/solution/subscriptions";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const requestId: string | undefined = undefined;
    const responseClone = response.clone();
    const responseText = await responseClone.text().catch(() => null);

    await logFortellisApiCall({
      requestId,
      method: "GET",
      url,
      requestHeaders: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      requestBody: null,
      responseStatus: response.status,
      responseHeaders: response.headers,
      responseBody: responseText,
    });

    if (!response.ok) {
      const errorText = responseText ?? (await response.text().catch(() => ""));
      throw new Error(
        `Subscriptions API returned ${response.status}: ${response.statusText} - ${errorText}`,
      );
    }

    const data = responseText ? JSON.parse(responseText) : await response.json();

    if (
      !data.subscriptions ||
      !Array.isArray(data.subscriptions) ||
      data.subscriptions.length === 0
    ) {
      throw new Error("No subscriptions found");
    }

    // Find subscription with FI Sales API (CDK Drive Get FI Sales or CDK Drive History Setup FI Sales)
    for (const subscription of data.subscriptions) {
      if (subscription.status !== "active") {
        continue;
      }

      // Look for FI Sales API in apiDmsInfo
      if (subscription.apiDmsInfo && Array.isArray(subscription.apiDmsInfo)) {
        for (const apiInfo of subscription.apiDmsInfo) {
          // Match FI Sales related APIs
          const isFISalesAPI =
            apiInfo.name?.includes("FI Sales") ||
            apiInfo.name?.includes("Get FI Sales") ||
            apiInfo.name?.includes("History Setup FI Sales");

          if (
            isFISalesAPI &&
            apiInfo.departments &&
            Array.isArray(apiInfo.departments) &&
            apiInfo.departments.length > 0
          ) {
            // Use the first department (or could filter by dmsType if needed)
            const department = apiInfo.departments[0];
            console.log(
              `Found subscription: ${subscription.subscriptionId}, department: ${department.id} (${department.name}) for API: ${apiInfo.name}`,
            );
            return {
              subscriptionId: subscription.subscriptionId,
              departmentId: department.id,
            };
          }
        }
      }
    }

    // Fallback: use first active subscription and first department if available
    const activeSubscription = data.subscriptions.find((sub: any) => sub.status === "active");
    if (activeSubscription) {
      // Try to find any department from any API
      for (const apiInfo of activeSubscription.apiDmsInfo || []) {
        if (
          apiInfo.departments &&
          Array.isArray(apiInfo.departments) &&
          apiInfo.departments.length > 0
        ) {
          const department = apiInfo.departments[0];
          console.log(
            `Using fallback subscription: ${activeSubscription.subscriptionId}, department: ${department.id} (${department.name})`,
          );
          return {
            subscriptionId: activeSubscription.subscriptionId,
            departmentId: department.id,
          };
        }
      }
    }

    throw new Error("No active subscription with FI Sales API and departments found");
  } catch (error) {
    console.error("Error fetching subscription info:", error);
    throw error;
  }
}

/**
 * Generate a unique UUID v4 request ID
 * Required by CDK API for request correlation
 */
export function generateUniqueRequestId(): string {
  return "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
