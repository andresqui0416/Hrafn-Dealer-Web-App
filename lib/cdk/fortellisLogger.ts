import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type HeadersLike = Headers | Record<string, string | string[]> | Array<[string, string]>;

export interface FortellisLogInput {
  requestId?: string | null;
  method: string;
  url: string;
  requestHeaders: HeadersLike;
  requestBody?: string | null;
  responseStatus: number;
  responseHeaders: HeadersLike;
  responseBody?: string | null;
}

function normalizeAndMaskHeaders(headers: HeadersLike): Record<string, string> {
  const result: Record<string, string> = {};

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = maskHeaderValue(key, value);
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key.toLowerCase()] = maskHeaderValue(key, value);
    }
  } else {
    for (const [key, value] of Object.entries(headers)) {
      const headerValue = Array.isArray(value) ? value.join(", ") : value ?? "";
      result[key.toLowerCase()] = maskHeaderValue(key, headerValue);
    }
  }

  return result;
}

function maskHeaderValue(key: string, value: string): string {
  const lowerKey = key.toLowerCase();

  // Never log raw Authorization / Bearer tokens
  if (lowerKey === "authorization" || lowerKey.endsWith("-authorization")) {
    if (value.toLowerCase().startsWith("bearer ")) {
      return "Bearer [REDACTED]";
    }
    return "[REDACTED]";
  }

  // Generic token / secret / key headers
  if (
    lowerKey.includes("token") ||
    lowerKey.includes("secret") ||
    lowerKey.includes("apikey") ||
    lowerKey.includes("api-key")
  ) {
    return "[REDACTED]";
  }

  return value;
}

function maskBody(body: string | null | undefined): string | null {
  if (!body) return null;

  // Best-effort masking of common JWT / token fields in JSON bodies
  try {
    const parsed = JSON.parse(body);
    const masked = recursivelyMaskSensitiveFields(parsed);
    return JSON.stringify(masked);
  } catch {
    // Not JSON; at least mask any obvious "Bearer <token>" substrings
    return body.replace(/Bearer\s+[A-Za-z0-9\-\._]+/gi, "Bearer [REDACTED]");
  }
}

function recursivelyMaskSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(recursivelyMaskSensitiveFields);
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === "access_token" ||
        lowerKey === "id_token" ||
        lowerKey === "refresh_token" ||
        lowerKey.endsWith("token") ||
        lowerKey.includes("jwt")
      ) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = recursivelyMaskSensitiveFields(val);
      }
    }

    return result;
  }

  return value;
}

/**
 * Persist a structured Fortellis/CDK API log entry.
 * Designed to satisfy Fortellis certification requirements:
 * - Stores full request/response (with sensitive fields masked)
 * - Logs are queryable by Request-Id
 * - Retention enforced for at least 60 days
 */
export async function logFortellisApiCall(input: FortellisLogInput): Promise<void> {
  try {
    const cutoff = new Date();
    // Keep ~70 days to comfortably exceed 60-day requirement
    const seventyDaysMs = 70 * 24 * 60 * 60 * 1000;
    cutoff.setTime(cutoff.getTime() - seventyDaysMs);

    // Best-effort cleanup; don't block on this if it fails
    (prisma as any).fortellisApiLog
      .deleteMany({
        where: {
          createdAt: {
            lt: cutoff,
          },
        },
      })
      .catch(() => {
        // Swallow cleanup errors – logging must not break the main flow
      });

    await (prisma as any).fortellisApiLog.create({
      data: {
        requestId: input.requestId ?? null,
        method: input.method,
        url: input.url,
        requestHeaders: normalizeAndMaskHeaders(input.requestHeaders),
        requestBody: maskBody(input.requestBody ?? null),
        responseStatus: input.responseStatus,
        responseHeaders: normalizeAndMaskHeaders(input.responseHeaders),
        responseBody: maskBody(input.responseBody ?? null),
      },
    });
  } catch (error) {
    // Never let logging failures break the main API logic
    console.error("Failed to persist Fortellis API log:", error);
  }
}

