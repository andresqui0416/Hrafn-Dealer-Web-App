import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json({
      user: {
        id: payload.userId,
        email: payload.email,
        dealerId: payload.dealerId,
        role: payload.role,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
