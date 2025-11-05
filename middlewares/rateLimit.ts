import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // per window

export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Only apply rate limiting to API routes
  if (!pathname.startsWith("/api/")) {
    return null;
  }

  // Skip rate limiting for auth endpoints (handled separately if needed)
  if (pathname.startsWith("/api/auth/")) {
    return null;
  }

  const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();

  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return null; // Continue
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  record.count++;
  return null; // Continue
}

