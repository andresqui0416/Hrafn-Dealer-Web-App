import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth/jwt";

export async function authMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/cdk/") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/signup") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/admin/auth/login" ||
    pathname === "/api/admin/auth/logout"
  ) {
    return null;
  }

  if (pathname.startsWith("/api/inventory/sync")) {
    return null;
  }

  if (pathname.startsWith("/api/admin/")) {
    const token =
      request.cookies.get("admin_token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || !payload.adminId || !payload.email || !payload.name || !payload.adminRole) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-admin-id", payload.adminId);
    requestHeaders.set("x-admin-email", payload.email);
    requestHeaders.set("x-admin-name", payload.name);
    requestHeaders.set("x-admin-role", payload.adminRole);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (pathname.startsWith("/api/")) {
    const token =
      request.cookies.get("token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || !payload.userId || !payload.email || !payload.name) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-user-email", payload.email);
    requestHeaders.set("x-user-name", payload.name);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return null; // Continue to next middleware
}
