import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Admin info is already verified by middleware and attached to headers (guaranteed to exist)
    const adminId = request.headers.get("x-admin-id")!;
    const adminEmail = request.headers.get("x-admin-email")!;
    const adminName = request.headers.get("x-admin-name")!;
    const adminRole = request.headers.get("x-admin-role")!;

    return NextResponse.json({
      user: {
        id: adminId,
        email: adminEmail,
        name: adminName,
        role: adminRole,
      },
    });
  } catch (error) {
    console.error("Admin auth check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
