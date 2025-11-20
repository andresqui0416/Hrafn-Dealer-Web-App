import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET chat details (admins only)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get adminId from middleware-set header (guaranteed to exist by auth middleware)
    const adminId = request.headers.get("x-admin-id")!;

    // Allow viewing chats where adminId is null (new chats) OR where adminId matches (my chats)
    const chat = await prisma.chat.findUnique({
      where: { id: params.id },
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

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Verify access: admin can only see chats they are handling or unassigned chats
    if (chat.adminId && chat.adminId !== adminId) {
      return NextResponse.json(
        { error: "You can only access chats you are handling" },
        { status: 403 }
      );
    }

    return NextResponse.json({ chat });
  } catch (error) {
    console.error("Get chat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PUT update chat status (admins only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get adminId from middleware-set header (guaranteed to exist by auth middleware)
    const adminId = request.headers.get("x-admin-id")!;

    const body = await request.json();
    const { status } = body;

    const validStatuses = ["opened", "accepted", "closed"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be one of: opened, accepted, closed" },
        { status: 400 }
      );
    }

    const chat = await prisma.chat.findUnique({
      where: { id: params.id },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Only the handler admin can update status
    if (chat.adminId && chat.adminId !== adminId) {
      return NextResponse.json(
        { error: "You can only update chats you are handling" },
        { status: 403 }
      );
    }

    await prisma.chat.update({
      where: { id: params.id },
      data: { status: status as "opened" | "accepted" | "closed" },
    });

    return NextResponse.json({ status: "Chat status updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Update chat status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

