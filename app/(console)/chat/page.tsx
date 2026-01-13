"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Hi! I'm your Hrafn AI Agent. How can I help today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply || "(no response)",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I couldn’t reach the agent. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem-3rem-4rem)] flex-col">
      <div className="flex-1 overflow-y-auto rounded border border-white/10 p-4">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                    : "max-w-[80%] rounded-lg bg-white/5 px-3 py-2"
                }
              >
                <div className="text-sm leading-6">
                  {m.content.split(/```(\w+)?\n?/).map((part, idx) => {
                    if (idx % 2 === 1) {
                      // Code block
                      return (
                        <pre
                          key={idx}
                          className="my-2 overflow-x-auto rounded bg-black/30 p-2 text-xs font-mono"
                        >
                          {part}
                        </pre>
                      );
                    }
                    // Regular text
                    return (
                      <p key={idx} className="whitespace-pre-wrap">
                        {part}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          id="chatMessage"
          name="chatMessage"
          className="min-h-[44px] w-full resize-none rounded-md border border-white/10 bg-transparent p-3 text-sm outline-none focus:ring-1 focus:ring-white/20"
          placeholder={user ? "Type your message..." : "Please login to chat"}
          disabled={!user || sending}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
        />
        <Button onClick={sendMessage} disabled={!user || sending}>
          {sending ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
