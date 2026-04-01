/** Last message preview in list APIs is `messages[0]` (newest first). */

export type ChatListPreviewMessage = {
  id: string;
  content: string;
  createdAt: string;
};

export function patchChatListAfterMessage<
  T extends {
    id: string;
    updatedAt: string;
    messages: Array<{ id: string; content: string; createdAt: string }>;
    _count: { messages: number };
    unreadCount?: number;
  },
>(
  chats: T[],
  chatId: string,
  msg: ChatListPreviewMessage,
  options?: { unreadDelta?: number },
): T[] {
  const unreadDelta = options?.unreadDelta ?? 0;
  const now = new Date().toISOString();
  const idx = chats.findIndex((c) => c.id === chatId);
  if (idx === -1) return chats;

  const updated = chats.map((c) =>
    c.id === chatId
      ? {
          ...c,
          updatedAt: now,
          messages: [{ id: msg.id, content: msg.content, createdAt: msg.createdAt }],
          _count: { messages: c._count.messages + 1 },
          unreadCount: Math.max(0, (c.unreadCount ?? 0) + unreadDelta),
        }
      : c,
  );

  const row = updated[idx];
  const rest = updated.filter((_, i) => i !== idx);
  return [row, ...rest];
}
