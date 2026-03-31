import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { publishInboxEvent } from "@/lib/inbox/realtime";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = request.headers.get("x-user-id")!;
    const chatId = params.id;

    const chat = await prisma.chat.findUnique({
      where: { id: chatId, userId },
      select: { id: true },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const now = new Date();

    await prisma.message.updateMany({
      where: {
        chatId,
        senderType: "admin",
        readAt: null,
      },
      data: { readAt: now },
    });

    publishInboxEvent({
      type: "read_state_updated",
      chatId,
      userId,
      at: now.toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

