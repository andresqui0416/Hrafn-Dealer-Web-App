import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";


export async function POST(request: NextRequest) {
  try {
    // Get adminId from middleware-set header (guaranteed to exist by auth middleware)
    const adminId = request.headers.get("x-admin-id")!;

    const body = await request.json();
    const { userId, subject, content } = body;

    // userId must be provided in request body from UI
    if (!userId || !subject || !content) {
      return NextResponse.json(
        { error: "User ID, subject, and content are required" },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create chat with first message
    // adminId is set since admin is creating and will be the handler
    const chat = await prisma.chat.create({
      data: {
        userId,
        adminId, // Admin is already the handler
        subject: subject.trim(),
        status: "accepted", // Already accepted since admin created it
        messages: {
          create: {
            senderId: adminId,
            senderType: "admin",
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
        admin: {
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

