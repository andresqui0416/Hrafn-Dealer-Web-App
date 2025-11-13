import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth/jwt";

export async function authMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // Skip auth for auth endpoints (login, me, logout)
  if (
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/me") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/")
  ) {
    return null; // Let other middlewares handle or pass through
  }

  // Skip auth for inventory sync endpoint (uses API key authentication)
  if (pathname.startsWith("/api/inventory/sync")) {
    return null; // Let the route handle API key authentication
  }

  // Protect all /api/* routes except auth
  if (pathname.startsWith("/api/")) {
    const token =
      request.cookies.get("token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Attach user info to request headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-dealer-id", payload.dealerId);
    requestHeaders.set("x-user-role", payload.role);
    requestHeaders.set("x-user-email", payload.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return null; // Continue to next middleware
}
