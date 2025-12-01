// In-memory token cache
let tokenCache: {
  accessToken: string;
  expiresAt: number;
} | null = null;

/**
 * Get Fortellis OAuth2 access token
 * Uses client credentials flow and caches the token to avoid unnecessary requests
 * Refreshes proactively if token expires within 5 minutes
 */
export async function getFortellisAccessToken(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now();
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  
  // Check if we have a valid cached token (unless forcing refresh)
  // Also refresh proactively if token expires within 5 minutes
  // if (!forceRefresh && tokenCache && tokenCache.expiresAt > now + FIVE_MINUTES_MS) {
  //   return tokenCache.accessToken;
  // }
  

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

    // Cache the token (expires_in is typically in seconds, convert to milliseconds)
    // Subtract 60 seconds as a buffer to account for clock skew
    const expiresIn = (data.expires_in || 3600) * 1000 - 60000;
    const tokenCacheData = {
      accessToken: trimmedToken,
      expiresAt: Date.now() + expiresIn,
    }
    tokenCache = {...tokenCacheData};

    console.log(
      `Successfully obtained Fortellis access token (preview: \n\n${trimmedToken}\n\n)`,
    );
    return trimmedToken;
  } catch (error) {
    console.error("Error getting Fortellis access token:", error);
    throw error;
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
    const response = await fetch("https://subscriptions.fortellis.io/v1/solution/subscriptions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Subscriptions API returned ${response.status}: ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();

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
