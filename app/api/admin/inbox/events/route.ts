import { NextRequest } from "next/server";
import { subscribeInboxEvents } from "@/lib/inbox/realtime";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const adminId = request.headers.get("x-admin-id")!;

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "connected", at: new Date().toISOString() });

      unsubscribe = subscribeInboxEvents((event) => {
        // Only deliver admin-relevant events (assigned chats only)
        if (event.type === "message_created" || event.type === "read_state_updated") {
          if (event.adminId !== adminId) return;
          send(event);
          return;
        }

      });

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

