import {
  generateUniqueRequestId,
  getFortellisAccessToken,
  clearTokenCache,
} from "./index";
/**
 * Get query result from CDK API
 * Fetches the actual data from the result endpoint after operation completes
 * Automatically refreshes token on 401 errors
 */
async function getQueryResult(
  resultUrl: string,
  accessToken: string,
  subscriptionId: string,
  retryOn401: boolean = true,
): Promise<any[]> {
  try {
    console.log(`Fetching query result from: ${resultUrl}`);

    const resultResponse = await fetch(resultUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Subscription-Id": subscriptionId,
        "Request-Id": generateUniqueRequestId(),
        Accept: "application/json",
      },
    });

    // Handle 401 Unauthorized - token expired, refresh and retry once
    if (resultResponse.status === 401 && retryOn401) {
      console.log("Token expired during result fetch, refreshing token...");
      clearTokenCache();
      const newAccessToken = await getFortellisAccessToken(true);
      // Retry with new token (only once to avoid infinite loops)
      return getQueryResult(resultUrl, newAccessToken, subscriptionId, false);
    }

    if (!resultResponse.ok) {
      const errorText = await resultResponse.text();
      throw new Error(
        `Result fetch failed: ${resultResponse.status} ${resultResponse.statusText} - ${errorText}`,
      );
    }

    const resultData = await resultResponse.json();
    console.log(`Successfully fetched result data`);

    // CDK FI Sales response structure: { data: [...] }
    // Extract the data array from the response
    if (Array.isArray(resultData.data)) {
      return resultData.data;
    }

    console.warn("Unexpected result data structure:", Object.keys(resultData));
    return [];
  } catch (error) {
    console.error("Error fetching query result:", error);
    throw error;
  }
}

/**
 * Poll operation status until complete
 * Handles async bulk operations by polling the status endpoint
 * Automatically refreshes token on 401 errors
 */
export async function pollOperationStatus(
  statusUrl: string,
  accessToken: string,
  subscriptionId: string,
  checkAfterSeconds: number | null,
  maxWaitTime: number = 300000, // 5 minutes default
): Promise<any[]> {
  const startTime = Date.now();
  let currentAccessToken = accessToken;

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Wait for the specified time before checking
      if (checkAfterSeconds !== null) {
        await new Promise((resolve) => setTimeout(resolve, (checkAfterSeconds || 30) * 1000));
      } else {
        return await getQueryResult(
          statusUrl.replace("/status", "/result"),
          currentAccessToken,
          subscriptionId,
        );
      }

      // Refresh token before each status check to prevent expiration during long operations
      currentAccessToken = await getFortellisAccessToken();

      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${currentAccessToken}`,
          "Subscription-Id": subscriptionId,
          "Request-Id": generateUniqueRequestId(),
          Accept: "application/json",
        },
      });

      // Handle 401 Unauthorized - token expired, refresh and continue
      if (statusResponse.status === 401) {
        console.log("Token expired during status check, refreshing token...");
        clearTokenCache();
        currentAccessToken = await getFortellisAccessToken(true);
        // Continue to next iteration with new token
        continue;
      }

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        throw new Error(
          `Status check failed: ${statusResponse.status} ${statusResponse.statusText} - ${errorText}`,
        );
      }

      const statusData = await statusResponse.json();

      // Check if operation is completed
      if (statusData.status === "complete") {
        // Operation completed - fetch result from result endpoint
        if (statusData._links?.result?.href) {
          console.log(
            `Operation completed. Fetching result from: ${statusData._links.result.href}`,
          );
          // Refresh token before fetching result
          currentAccessToken = await getFortellisAccessToken();
          return await getQueryResult(statusData._links.result.href, currentAccessToken, subscriptionId);
        }
      }
      continue;
    } catch (error) {
      console.error("Error checking operation status:", error);
      throw error;
    }
  }

  throw new Error(`Operation timed out after ${maxWaitTime / 1000} seconds`);
}

/**
 * Generic function to fetch FI Sales data from CDK/Fortellis API
 * Handles OAuth, subscription discovery, and async bulk operations
 * @param endpointPath - The endpoint path (e.g., "bulk", "open", "open/delta", "closed", "closed/delta")
 * @param departmentId - Optional department ID
 * @param startDate - Optional start date (ISO 8601 format: yyyy-mm-ddThh:mm:ss)
 * @param endDate - Optional end date (ISO 8601 format: yyyy-mm-ddThh:mm:ss)
 */
export async function getFISalesData(
  endpointPath: string,
  departmentId?: string,
  subscriptionId?: string | null,
  startDate?: string,
  endDate?: string,
): Promise<any[]> {
  // Get access token
  let accessToken = await getFortellisAccessToken();
  console.log("Getting FISales data...");
  console.log("Subscription ID:", subscriptionId);
  console.log("Department ID:", departmentId);
  console.log("Start date:", startDate);
  console.log("End date:", endDate);

  // Get subscription and department info
  // Priority: 1) Provided departmentId parameter, 2) Environment variables, 3) Fetch from API
  let deptId = departmentId;

  if (!subscriptionId) {
    throw new Error(
      "Subscription ID is required. Provide as parameter, or ensure API returns subscriptions.",
    );
  }

  if (!deptId) {
    throw new Error(
      "Department ID is required. Provide as parameter, or ensure API returns departments.",
    );
  }

  try {
    // Build the endpoint URL
    const baseUrl = "https://api.fortellis.io/cdk-test/drive/fisales/v3";
    const endpoint = `${baseUrl}/${endpointPath}`;

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (startDate) {
      queryParams.append("startDate", startDate);
    }
    if (endDate) {
      queryParams.append("endDate", endDate);
    }
    const url = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;

    let response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Subscription-Id": subscriptionId,
        "Department-Id": deptId,
        "Request-Id": generateUniqueRequestId(), // Generate unique request ID
        Accept: "application/json",
      },
    });

    // Handle 401 Unauthorized - token expired, refresh and retry once
    if (response.status === 401) {
      console.log("Token expired during initial request, refreshing token...");
      clearTokenCache();
      accessToken = await getFortellisAccessToken(true);
      console.log("Retrying request with refreshed token...");
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Subscription-Id": subscriptionId,
          "Department-Id": deptId,
          "Request-Id": generateUniqueRequestId(),
          Accept: "application/json",
        },
      });
      
      // If still 401 after refresh, something is wrong with credentials
      if (response.status === 401) {
        const errorText = await response.text();
        throw new Error(`CDK API returned 401 after token refresh: ${errorText}`);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CDK API returned ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const operationResponse = await response.json();

    // Check if this is an async operation response
    if (operationResponse.operationId && operationResponse._links?.status?.href) {
      console.log(
        `Received async operation ID: ${operationResponse.operationId}, status: ${operationResponse.status}`,
      );

      // Poll the status endpoint until operation completes
      const statusUrl = operationResponse._links.status.href;
      const checkAfterSeconds = operationResponse.checkStatusAfterSeconds || 30;

      console.log(`Polling operation status at: ${statusUrl}`);
      return await pollOperationStatus(statusUrl, accessToken, subscriptionId, checkAfterSeconds);
    } else {
      // Direct response (shouldn't happen based on the example, but handle it)
      return Array.isArray(operationResponse)
        ? operationResponse
        : operationResponse.items ||
            operationResponse.inventory ||
            operationResponse.data ||
            operationResponse.vehicles ||
            [];
    }
  } catch (error) {
    console.error("Error fetching from CDK API:", error);
    throw error;
  }
}

/**
 * Fetch historical FI Sales data from CDK/Fortellis API (older than 31 days)
 * Handles OAuth, subscription discovery, and async bulk operations
 * @param departmentId - Optional department ID
 * @param startDate - Required start date (ISO 8601 format: yyyy-mm-ddThh:mm:ss)
 * @param endDate - Optional end date (ISO 8601 format: yyyy-mm-ddThh:mm:ss). Defaults to current date - 31 days
 * @returns Array of historical vehicle sale records with status 'F' (finalized)
 */
export async function getFISalesHistoryData(
  departmentId?: string,
  subscriptionId?: string | null,
  startDate?: string,
  endDate?: string,
): Promise<any[]> {
  // Get access token
  let accessToken = await getFortellisAccessToken();
  console.log("Subscription ID:", subscriptionId);
  console.log("Department ID:", departmentId);
  console.log("Start date:", startDate);
  console.log("End date:", endDate);

  // Get subscription and department info
  // Priority: 1) Provided departmentId parameter, 2) Environment variables, 3) Fetch from API
  let deptId = departmentId;

  if (!subscriptionId) {
    throw new Error(
      "Subscription ID is required. Provide as parameter, or ensure API returns subscriptions.",
    );
  }

  if (!deptId) {
    throw new Error(
      "Department ID is required. Provide as parameter, or ensure API returns departments.",
    );
  }

  if (!startDate) {
    throw new Error("Start date is required for historical data retrieval.");
  }

  try {
    // Build the endpoint URL - History Setup uses different base path
    const baseUrl = "https://api.fortellis.io/cdk-test/drive/fisalessetup/v3";
    const endpoint = `${baseUrl}/history`;

    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append("startDate", startDate);
    if (endDate) {
      queryParams.append("endDate", endDate);
    }
    const url = `${endpoint}?${queryParams.toString()}`;

    let response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Subscription-Id": subscriptionId,
        "Department-Id": deptId,
        "Request-Id": generateUniqueRequestId(), // Generate unique request ID
        Accept: "application/json",
      },
    });

    // Handle 401 Unauthorized - token expired, refresh and retry once
    if (response.status === 401) {
      console.log("Token expired during history request, refreshing token...");
      clearTokenCache();
      accessToken = await getFortellisAccessToken(true);
      console.log("Retrying history request with refreshed token...");
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Subscription-Id": subscriptionId,
          "Department-Id": deptId,
          "Request-Id": generateUniqueRequestId(),
          Accept: "application/json",
        },
      });
      
      // If still 401 after refresh, something is wrong with credentials
      if (response.status === 401) {
        const errorText = await response.text();
        throw new Error(`CDK API returned 401 after token refresh: ${errorText}`);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CDK API returned ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const operationResponse = await response.json();

    // Check if this is an async operation response
    if (operationResponse.operationId && operationResponse._links?.status?.href) {
      console.log(
        `Received async operation ID: ${operationResponse.operationId}, status: ${operationResponse.status}`,
      );

      // Poll the status endpoint until operation completes
      const statusUrl = operationResponse._links.status.href;
      const checkAfterSeconds = operationResponse.checkStatusAfterSeconds || 30;

      console.log(`Polling operation status at: ${statusUrl}`);
      return await pollOperationStatus(statusUrl, accessToken, subscriptionId, checkAfterSeconds);
    } else {
      // Direct response (shouldn't happen based on the example, but handle it)
      return Array.isArray(operationResponse)
        ? operationResponse
        : operationResponse.items ||
            operationResponse.inventory ||
            operationResponse.data ||
            operationResponse.vehicles ||
            [];
    }
  } catch (error) {
    console.error("Error fetching historical data from CDK API:", error);
    throw error;
  }
}

/**
 * Fetch inventory data from CDK/Fortellis API (backward compatibility)
 * Handles OAuth, subscription discovery, and async bulk operations
 */
export async function getFISalesBulkData(
  departmentId?: string,
): Promise<any[]> {
  return getFISalesData("bulk", departmentId);
}
