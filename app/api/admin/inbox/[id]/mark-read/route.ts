import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { publishInboxEvent } from "@/lib/inbox/realtime";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminId = request.headers.get("x-admin-id")!;
    const chatId = params.id;

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, adminId: true },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Unassigned (new) chats: nothing to mark as read for this admin until they accept.
    if (!chat.adminId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (chat.adminId !== adminId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();

    await prisma.message.updateMany({
      where: {
        chatId,
        senderType: "user",
        readAt: null,
      },
      data: { readAt: now },
    });

    publishInboxEvent({
      type: "read_state_updated",
      chatId,
      adminId,
      at: now.toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin mark read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

