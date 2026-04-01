export type InboxEvent =
  | {
      type: "message_created";
      chatId: string;
      userId: string;
      adminId: string | null;
      messageId: string;
      content: string;
      createdAt: string;
      senderType: "user" | "admin";
    }
  | {
      type: "chat_created";
      chatId: string;
      userId: string;
      createdAt: string;
    }
  | {
      type: "read_state_updated";
      chatId: string;
      userId?: string;
      adminId?: string;
      at: string;
    };

type Listener = (event: InboxEvent) => void;

function getBus(): { listeners: Set<Listener> } {
  const g = globalThis as unknown as { __inboxRealtimeBus?: { listeners: Set<Listener> } };
  if (!g.__inboxRealtimeBus) {
    g.__inboxRealtimeBus = { listeners: new Set() };
  }
  return g.__inboxRealtimeBus;
}

export function publishInboxEvent(event: InboxEvent) {
  const bus = getBus();
  for (const listener of bus.listeners) {
    try {
      listener(event);
    } catch {
      // ignore listener failures
    }
  }
}

export function subscribeInboxEvents(listener: Listener) {
  const bus = getBus();
  bus.listeners.add(listener);
  return () => {
    bus.listeners.delete(listener);
  };
}

