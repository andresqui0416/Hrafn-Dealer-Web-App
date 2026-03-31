import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminId = request.headers.get("x-admin-id")!;

    const count = await prisma.message.count({
      where: {
        senderType: "user",
        readAt: null,
        chat: { adminId },
      },
    });
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Get admin unread count error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

