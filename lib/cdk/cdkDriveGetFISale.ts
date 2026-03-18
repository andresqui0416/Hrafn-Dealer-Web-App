import { generateUniqueRequestId, getFortellisAccessToken } from "./index";
import { logFortellisApiCall } from "./fortellisLogger";

async function getQueryResult(
  resultUrl: string,
  accessToken: string,
  subscriptionId: string,
  retryOn401: boolean = true,
): Promise<any[]> {
  try {
    console.log(`Fetching query result from: ${resultUrl}`);

    const requestId = generateUniqueRequestId();

    const resultResponse = await fetch(resultUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Subscription-Id": subscriptionId,
        "Request-Id": requestId,
        Accept: "application/json",
      },
    });

    // Handle 401 Unauthorized - token expired, refresh and retry once
    if (resultResponse.status === 401 && retryOn401) {
      console.log("Token expired during result fetch, refreshing token...");
      const newAccessToken = await getFortellisAccessToken(true);
      // Retry with new token (only once to avoid infinite loops)
      return getQueryResult(resultUrl, newAccessToken, subscriptionId, false);
    }

    const resultClone = resultResponse.clone();
    const responseText = await resultClone.text().catch(() => null);

    await logFortellisApiCall({
      requestId,
      method: "GET",
      url: resultUrl,
      requestHeaders: {
        Authorization: `Bearer ${accessToken}`,
        "Subscription-Id": subscriptionId,
        "Request-Id": requestId,
        Accept: "application/json",
      },
      requestBody: null,
      responseStatus: resultResponse.status,
      responseHeaders: resultResponse.headers,
      responseBody: responseText,
    });

    if (!resultResponse.ok) {
      const errorText = responseText ?? (await resultResponse.text().catch(() => ""));
      throw new Error(
        `Result fetch failed: ${resultResponse.status} ${resultResponse.statusText} - ${errorText}`,
      );
    }

    const resultData = responseText ? JSON.parse(responseText) : await resultResponse.json();
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

async function pollOperationStatus(
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

      const requestId = generateUniqueRequestId();

      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${currentAccessToken}`,
          "Subscription-Id": subscriptionId,
          "Request-Id": requestId,
          Accept: "application/json",
        },
      });

      // Handle 401 Unauthorized - token expired, refresh and continue
      if (statusResponse.status === 401) {
        console.log("Token expired during status check, refreshing token...");
        currentAccessToken = await getFortellisAccessToken(true);
        // Continue to next iteration with new token
        continue;
      }

      const statusClone = statusResponse.clone();
      const statusText = await statusClone.text().catch(() => null);

      await logFortellisApiCall({
        requestId,
        method: "GET",
        url: statusUrl,
        requestHeaders: {
          Authorization: `Bearer ${currentAccessToken}`,
          "Subscription-Id": subscriptionId,
          "Request-Id": requestId,
          Accept: "application/json",
        },
        requestBody: null,
        responseStatus: statusResponse.status,
        responseHeaders: statusResponse.headers,
        responseBody: statusText,
      });

      if (!statusResponse.ok) {
        const errorText = statusText ?? (await statusResponse.text().catch(() => ""));
        throw new Error(
          `Status check failed: ${statusResponse.status} ${statusResponse.statusText} - ${errorText}`,
        );
      }

      const statusData = statusText ? JSON.parse(statusText) : await statusResponse.json();

      // Check if operation is completed
      if (statusData.status === "complete") {
        // Operation completed - fetch result from result endpoint
        if (statusData._links?.result?.href) {
          console.log(
            `Operation completed. Fetching result from: ${statusData._links.result.href}`,
          );
          // Refresh token before fetching result
          currentAccessToken = await getFortellisAccessToken();
          return await getQueryResult(
            statusData._links.result.href,
            currentAccessToken,
            subscriptionId,
          );
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

export async function getFISalesData(
  endpointPath: string,
  departmentId: string,
  subscriptionId: string,
  startDate: string,
  endDate: string,
  retryCount: number = 0,
): Promise<any> {
  if (retryCount >= 3) {
    throw new Error("Failed to fetch FI Sales data from CDK API after 3 retries.");
  }

  console.log("==============================================\n");
  console.log("Getting FISales data...");
  console.log("Subscription ID:", subscriptionId);
  console.log("Department ID:", departmentId);
  console.log("Start date:", startDate);
  console.log("End date:", endDate);
  console.log("Fetching fresh access token...");
  let accessToken = await getFortellisAccessToken();
  console.log(`Got access token (length: ${accessToken.length})`);

  let deptId = departmentId;

  if (!subscriptionId || subscriptionId === "" || subscriptionId === null) {
    throw new Error(
      "Subscription ID is required. Provide as parameter, or ensure API returns subscriptions.",
    );
  }

  if (!deptId || deptId === "" || deptId === null) {
    throw new Error(
      "Department ID is required. Provide as parameter, or ensure API returns departments.",
    );
  }

  try {
    const baseUrl = "https://api.fortellis.io/cdk-test/drive/fisales/v3";
    const endpoint = `${baseUrl}/${endpointPath}`;

    const queryParams = new URLSearchParams();
    if (startDate) {
      queryParams.append("startDate", startDate);
    }
    if (endDate) {
      queryParams.append("endDate", endDate);
    }
    const url = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;

    const requestId = generateUniqueRequestId();

    let response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Subscription-Id": subscriptionId,
        "Department-Id": deptId,
        "Request-Id": requestId,
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      console.error(await response.text());
      console.log("Token expired, refreshing token...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      accessToken = await getFortellisAccessToken(true);
      return await getFISalesData(
        endpointPath,
        departmentId,
        subscriptionId,
        startDate,
        endDate,
        retryCount + 1,
      );
    }

    const responseClone = response.clone();
    const responseText = await responseClone.text().catch(() => null);

    await logFortellisApiCall({
      requestId,
      method: "GET",
      url,
      requestHeaders: {
        Authorization: `Bearer ${accessToken}`,
        "Subscription-Id": subscriptionId,
        "Department-Id": deptId,
        "Request-Id": requestId,
        Accept: "application/json",
      },
      requestBody: null,
      responseStatus: response.status,
      responseHeaders: response.headers,
      responseBody: responseText,
    });

    if (!response.ok) {
      const errorText = responseText ?? (await response.text().catch(() => ""));
      throw new Error(`CDK API returned ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const operationResponse = responseText
      ? JSON.parse(responseText)
      : await response.json();

    if (operationResponse.operationId && operationResponse._links?.status?.href) {
      console.log(
        `Received async operation ID: ${operationResponse.operationId}, status: ${operationResponse.status}`,
      );

      const statusUrl = operationResponse._links.status.href;
      const checkAfterSeconds = operationResponse.checkStatusAfterSeconds || 30;

      console.log(`Polling operation status at: ${statusUrl}`);
      return await pollOperationStatus(statusUrl, accessToken, subscriptionId, checkAfterSeconds);
    }
  } catch (error) {
    console.error("Error fetching from CDK API:", error);
    throw error;
  }
}

export async function getFISalesHistoryData(
  departmentId: string,
  subscriptionId: string,
  startDate: string,
  endDate: string,
  retryCount: number = 0,
): Promise<any> {
  if (retryCount > 3) {
    throw new Error("Failed to fetch historical data from CDK API after 3 retries.");
  }
  console.log("==============================================\n");
  console.log("Getting historical FISales data...");
  console.log("Subscription ID:", subscriptionId);
  console.log("Department ID:", departmentId);
  console.log("Start date:", startDate);
  console.log("End date:", endDate);
  console.log("Fetching fresh access token for historical data...");
  let accessToken = await getFortellisAccessToken();

  // Get subscription and department info
  // Priority: 1) Provided departmentId parameter, 2) Environment variables, 3) Fetch from API
  let deptId = departmentId;

  if (!subscriptionId || subscriptionId === "" || subscriptionId === null) {
    throw new Error(
      "Subscription ID is required. Provide as parameter, or ensure API returns subscriptions.",
    );
  }

  if (!deptId || deptId === "" || deptId === null) {
    throw new Error(
      "Department ID is required. Provide as parameter, or ensure API returns departments.",
    );
  }

  if (!startDate || startDate === "" || startDate === null) {
    throw new Error("Start date is required for historical data retrieval.");
  }

  if (!endDate || endDate === "" || endDate === null) {
    throw new Error("End date is required for historical data retrieval.");
  }

  try {
    // Build the endpoint URL - History Setup uses different base path
    const baseUrl = "https://api.fortellis.io/cdk-test/drive/fisalessetup/v3";
    const endpoint = `${baseUrl}/history`;

    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append("startDate", startDate);
    queryParams.append("endDate", endDate);
    const url = `${endpoint}?${queryParams.toString()}`;

    const requestId = generateUniqueRequestId();

    let response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Subscription-Id": subscriptionId,
        "Department-Id": deptId,
        "Request-Id": requestId, // Generate unique request ID
        Accept: "application/json",
      },
    });

    if (response.status === 401) {
      console.error(await response.text());
      console.log("Token expired, refreshing token...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      accessToken = await getFortellisAccessToken(true);
      return await getFISalesHistoryData(
        departmentId,
        subscriptionId,
        startDate,
        endDate,
        retryCount + 1,
      );
    }

    const responseClone = response.clone();
    const responseText = await responseClone.text().catch(() => null);

    await logFortellisApiCall({
      requestId,
      method: "GET",
      url,
      requestHeaders: {
        Authorization: `Bearer ${accessToken}`,
        "Subscription-Id": subscriptionId,
        "Department-Id": deptId,
        "Request-Id": requestId,
        Accept: "application/json",
      },
      requestBody: null,
      responseStatus: response.status,
      responseHeaders: response.headers,
      responseBody: responseText,
    });

    if (!response.ok) {
      const errorText = responseText ?? (await response.text().catch(() => ""));
      throw new Error(`CDK API returned ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const operationResponse = responseText
      ? JSON.parse(responseText)
      : await response.json();

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
    }
  } catch (error) {
    console.error("Error fetching historical data from CDK API:", error);
    throw error;
  }
}
