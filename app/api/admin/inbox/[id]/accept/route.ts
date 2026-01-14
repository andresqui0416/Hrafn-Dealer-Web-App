import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// PUT accept a chat (assign admin as handler)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get adminId from middleware-set header (guaranteed to exist by auth middleware)
    const adminId = request.headers.get("x-admin-id")!;

    // Find chat where adminId is null (new chat) or matches current admin
    const chat = await prisma.chat.findUnique({
      where: { id: params.id },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Only allow accepting chats that don't have a handler yet
    if (chat.adminId !== null) {
      return NextResponse.json(
        { error: "Chat is already assigned to another admin" },
        { status: 403 },
      );
    }

    // Accept the chat: assign admin and change status to accepted
    await prisma.chat.update({
      where: { id: params.id },
      data: {
        adminId,
        status: "accepted",
      },
    });

    return NextResponse.json({ status: "Chat accepted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Accept chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
