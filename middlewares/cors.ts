import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"];

export function corsMiddleware(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Only apply CORS to API routes
  if (!pathname.startsWith("/api/")) {
    return null;
  }

  const origin = request.headers.get("origin");

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
  }

  // For actual requests, add CORS headers if needed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    // Headers will be added in the response by Next.js or manually in route handlers
    return null;
  }

  return null;
}
