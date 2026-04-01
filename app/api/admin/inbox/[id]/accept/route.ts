import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// PUT accept a chat (assign admin as handler)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get adminId from middleware-set header (guaranteed to exist by auth middleware)
    const adminId = request.headers.get("x-admin-id")?.trim();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    try {
      const updated = await prisma.chat.update({
        where: { id: params.id },
        data: {
          adminId,
          status: "accepted",
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          admin: {
            select: { id: true, name: true, email: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, content: true, createdAt: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      });

      return NextResponse.json(
        { status: "Chat accepted successfully", chat: updated },
        { status: 200 },
      );
    } catch (e: unknown) {
      if (e instanceof PrismaClientKnownRequestError && e.code === "P2003") {
        return NextResponse.json(
          { error: "Unable to assign chat. Please sign in again." },
          { status: 401 },
        );
      }
      throw e;
    }
  } catch (error) {
    console.error("Accept chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
