import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUnreadCountByChatIdForAdmin } from "@/lib/inbox/unread-by-chat";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// GET my chats (chats where admin is the handler)
export async function GET(request: NextRequest) {
  try {
    // Get adminId from middleware-set header (guaranteed to exist by auth middleware)
    const adminId = request.headers.get("x-admin-id")!;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "all", "active" (accepted), or "closed"
    const search = searchParams.get("search")?.trim() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);

    const validPageSize = Math.min(Math.max(1, pageSize), 100);

    // Build where clause
    const where: any = { adminId };

    // Status filter
    if (status === "active") {
      where.status = "accepted";
    } else if (status === "closed") {
      where.status = "closed";
    }
    // If status is "all" or not provided, don't filter by status

    // Search filter (user name or email)
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      };
    }

    const totalCount = await prisma.chat.count({ where });
    const totalPages = Math.max(1, Math.ceil(totalCount / validPageSize) || 1);
    const validPage = Math.min(Math.max(1, page), totalPages);
    const skip = (validPage - 1) * validPageSize;

    // My chats: admin is the handler
    const chats = await prisma.chat.findMany({
      where,
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
    const unreadMap = await getUnreadCountByChatIdForAdmin(prisma, chatIds, {
      kind: "assigned",
      adminId,
    });
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
    console.error("Get my chats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
