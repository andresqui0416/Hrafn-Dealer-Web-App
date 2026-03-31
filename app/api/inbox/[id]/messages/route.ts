import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { publishInboxEvent } from "@/lib/inbox/realtime";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET messages for a chat (users only)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = request.headers.get("x-user-id")!;

    const chat = await prisma.chat.findUnique({
      where: { id: params.id, userId: userId },
      select: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ messages: chat.messages || [] });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST send a message (users only)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = request.headers.get("x-user-id")!;

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const chat = await prisma.chat.findUnique({
      where: { id: params.id, userId: userId },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: userId,
        senderType: "user",
        content: content.trim(),
      },
    });

    // Update chat's updatedAt timestamp
    const updatedChat = await prisma.chat.update({
      where: { id: params.id },
      data: {
        status: "accepted",
        updatedAt: new Date(),
      },
    });

    publishInboxEvent({
      type: "message_created",
      chatId: chat.id,
      userId,
      adminId: updatedChat.adminId,
      messageId: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      senderType: "user",
    });

    return NextResponse.json(
      {
        message,
        chat: { id: updatedChat.id, status: updatedChat.status },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
