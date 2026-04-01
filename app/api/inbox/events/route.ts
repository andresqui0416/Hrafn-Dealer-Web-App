import { NextRequest } from "next/server";
import { subscribeInboxEvents } from "@/lib/inbox/realtime";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id")!;

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Initial hello
      send({ type: "connected", at: new Date().toISOString() });

      unsubscribe = subscribeInboxEvents((event) => {
        // Only deliver user-relevant events
        if (
          event.type === "chat_created" || 
          event.type === "read_state_updated" || 
          event.type === "message_created") {
          if (event.userId !== userId) return;
          send(event);
          return;
        }
      });

      // Keepalive ping every 25s (helps proxies/timeouts)
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
      }, 25_000);

      const onAbort = () => {
        clearInterval(interval);
        unsubscribe?.();
        controller.close();
      };

      request.signal.addEventListener("abort", onAbort);
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

