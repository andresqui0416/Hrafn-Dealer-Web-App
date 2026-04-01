import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { publishInboxEvent } from "@/lib/inbox/realtime";
import { getUnreadCountByChatIdForUser } from "@/lib/inbox/unread-by-chat";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET user's chats
export async function GET(request: NextRequest) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = request.headers.get("x-user-id")!;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);

    const validPageSize = Math.min(Math.max(1, pageSize), 100);
    const totalCount = await prisma.chat.count({ where: { userId } });
    const totalPages = Math.max(1, Math.ceil(totalCount / validPageSize) || 1);
    const validPage = Math.min(Math.max(1, page), totalPages);
    const skip = (validPage - 1) * validPageSize;

    const chats = await prisma.chat.findMany({
      where: { userId },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1, // Get only the latest message for preview
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: validPageSize,
    });

    const chatIds = chats.map((c) => c.id);
    const unreadMap = await getUnreadCountByChatIdForUser(prisma, chatIds, userId);
    const chatsWithUnread = chats.map((c) => ({
      ...c,
      unreadCount: unreadMap[c.id] ?? 0,
    }));

    return NextResponse.json({
      chats: chatsWithUnread,
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get chats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST create new chat (users only)
export async function POST(request: NextRequest) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    // Only users can create chats here - admins use /api/admin/inbox
    const userId = request.headers.get("x-user-id")!;

    const body = await request.json();
    const { subject, content } = body;

    if (!subject || !content) {
      return NextResponse.json({ error: "Subject and content are required" }, { status: 400 });
    }

    // Create chat with first message
    // adminId is null when user creates - admin will be assigned when they accept
    const chat = await prisma.chat.create({
      data: {
        userId,
        adminId: null, // No handler yet - will be set when admin accepts
        subject: subject.trim(),
        status: "opened", // Opened when user creates
        messages: {
          create: {
            senderId: userId,
            senderType: "user",
            content: content.trim(),
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    publishInboxEvent({
      type: "chat_created",
      chatId: chat.id,
      userId,
      createdAt: chat.createdAt.toISOString(),
    });

    return NextResponse.json({ chat }, { status: 201 });
  } catch (error) {
    console.error("Create chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
