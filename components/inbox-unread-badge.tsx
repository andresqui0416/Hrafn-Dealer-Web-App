"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  variant: "user" | "admin";
  /** When the Inbox nav item is selected, badge uses contrasting colors on the primary row. */
  active?: boolean;
  className?: string;
};

export function InboxUnreadBadge({ variant, active = false, className }: Props) {
  const [count, setCount] = useState<number>(0);

  const unreadUrl = variant === "admin" ? "/api/admin/inbox/unread-count" : "/api/inbox/unread-count";
  const eventsUrl = variant === "admin" ? "/api/admin/inbox/events" : "/api/inbox/events";

  useEffect(() => {
    let es: EventSource | null = null;
    let pollInterval: number | null = null;
    let cancelled = false;

    const refresh = async () => {
      try {
        const res = await fetch(unreadUrl, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled) setCount(typeof data.count === "number" ? data.count : 0);
      } catch {
        // ignore
      }
    };

    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = window.setInterval(refresh, 5000);
    };

    refresh();

    try {
      es = new EventSource(eventsUrl);
      es.onmessage = () => refresh();
      es.onerror = () => {
        es?.close();
        es = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      cancelled = true;
      es?.close();
      if (pollInterval) window.clearInterval(pollInterval);
    };
  }, [eventsUrl, unreadUrl]);

  if (!count || count <= 0) return null;

  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold transition-colors",
        active
          ? "bg-primary-foreground text-primary shadow-sm"
          : "bg-primary text-primary-foreground",
        className,
      )}
      aria-label={`${count} unread messages`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

