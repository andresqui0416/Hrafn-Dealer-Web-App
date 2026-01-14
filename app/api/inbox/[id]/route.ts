import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET chat details (users only)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = request.headers.get("x-user-id")!;

    const chat = await prisma.chat.findUnique({
      where: { id: params.id, userId: userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ chat });
  } catch (error) {
    console.error("Get chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
