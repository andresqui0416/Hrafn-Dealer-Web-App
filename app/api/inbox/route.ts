import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET user's chats
export async function GET(request: NextRequest) {
  try {
    // Get userId from middleware-set header (guaranteed to exist by auth middleware)
    const userId = request.headers.get("x-user-id")!;

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
    });

    return NextResponse.json({ chats });
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

    return NextResponse.json({ chat }, { status: 201 });
  } catch (error) {
    console.error("Create chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
