import type { PrismaClient } from "@prisma/client";

/** Unread for dealer (user): admin messages not yet read. */
export async function getUnreadCountByChatIdForUser(
  prisma: PrismaClient,
  chatIds: string[],
  userId: string,
): Promise<Record<string, number>> {
  if (chatIds.length === 0) return {};
  const groups = await prisma.message.groupBy({
    by: ["chatId"],
    where: {
      chatId: { in: chatIds },
      senderType: "admin",
      readAt: null,
      chat: { userId },
    },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.chatId, g._count._all]));
}

type AdminUnreadScope =
  | { kind: "assigned"; adminId: string }
  | { kind: "unassigned" };

/** Unread for admin: user messages not yet read (per chat). Scoped to assigned or unassigned queues. */
export async function getUnreadCountByChatIdForAdmin(
  prisma: PrismaClient,
  chatIds: string[],
  scope: AdminUnreadScope,
): Promise<Record<string, number>> {
  if (chatIds.length === 0) return {};
  const chatFilter =
    scope.kind === "assigned"
      ? { adminId: scope.adminId }
      : { adminId: null };
  const groups = await prisma.message.groupBy({
    by: ["chatId"],
    where: {
      chatId: { in: chatIds },
      senderType: "user",
      readAt: null,
      chat: chatFilter,
    },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.chatId, g._count._all]));
}
