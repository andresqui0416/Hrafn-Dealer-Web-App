"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faCheck,
  faChevronDown,
  faComments,
  faCopy,
  faCircleNotch,
  faRobot,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

const MAIN_SCROLL_ID = "console-main-scroll";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_PROMPTS = [
  "What were my sales last month?",
  "How many vehicles do we have in inventory?",
  "Summarize revenue and commissions for this quarter.",
];

const SCROLL_BOTTOM_THRESHOLD = 140;

function getMainScrollEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(MAIN_SCROLL_ID);
}

/** Phone / tablet / touch hardware: show copy controls without relying on hover. */
function useTouchFriendlyUi(): boolean {
  const [touchFriendlyUi, setTouchFriendlyUi] = useState(false);
  useEffect(() => {
    const coarseMq = window.matchMedia("(pointer: coarse)");
    const update = () => {
      const hasTouchScreen =
        typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
      setTouchFriendlyUi(hasTouchScreen || coarseMq.matches);
    };
    update();
    coarseMq.addEventListener("change", update);
    return () => coarseMq.removeEventListener("change", update);
  }, []);
  return touchFriendlyUi;
}

function parseBold(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <strong key={key++} className="font-semibold">
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function renderMessageContent(content: string) {
  return content.split(/```(\w+)?\n?/).map((part, idx) => {
    if (idx % 2 === 1) {
      return (
        <pre
          key={idx}
          className="my-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-3 text-xs font-mono leading-relaxed"
        >
          {part}
        </pre>
      );
    }
    return (
      <p key={idx} className="whitespace-pre-wrap [&:not(:last-child)]:mb-2">
        {parseBold(part)}
      </p>
    );
  });
}

export default function ChatPage() {
  const { user } = useAuth();
  const touchFriendlyUi = useTouchFriendlyUi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [suppressCopyHoverMessageId, setSuppressCopyHoverMessageId] = useState<string | null>(null);
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copySuppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) clearTimeout(copyResetTimeoutRef.current);
      if (copySuppressTimeoutRef.current) clearTimeout(copySuppressTimeoutRef.current);
    };
  }, []);

  const updateScrollPinned = useCallback(() => {
    const el = getMainScrollEl();
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < SCROLL_BOTTOM_THRESHOLD);
  }, []);

  useLayoutEffect(() => {
    const el = getMainScrollEl();
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: messages.length <= 1 ? "auto" : "smooth" });
    setAtBottom(true);
  }, [messages]);

  useEffect(() => {
    const el = getMainScrollEl();
    if (!el) return;
    const onScroll = () => updateScrollPinned();
    el.addEventListener("scroll", onScroll, { passive: true });
    updateScrollPinned();
    return () => el.removeEventListener("scroll", onScroll);
  }, [updateScrollPinned, messages.length]);

  const scrollToLatest = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setAtBottom(true);
  }, []);

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Uncapped height: outer .chat-composer-scroll handles max height + scrolling (reliable scrollbar styling on Windows).
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

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
      if (!res.ok) {
        const err =
          typeof data?.error === "string"
            ? data.error
            : "The agent could not complete that request.";
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: err,
          },
        ]);
        return;
      }
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply || "(no response)",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
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

  const copyToClipboard = useCallback((text: string, messageId: string) => {
    void navigator.clipboard.writeText(text);
    if (copyResetTimeoutRef.current) clearTimeout(copyResetTimeoutRef.current);
    if (copySuppressTimeoutRef.current) clearTimeout(copySuppressTimeoutRef.current);
    setCopiedMessageId(messageId);
    setSuppressCopyHoverMessageId(messageId);

    copyResetTimeoutRef.current = setTimeout(() => {
      setCopiedMessageId(null);
      copyResetTimeoutRef.current=null;
      copySuppressTimeoutRef.current = setTimeout(() => {
        setSuppressCopyHoverMessageId(null);
        copySuppressTimeoutRef.current = null;
      }, 320);
    }, 2000);
  }, []);

  const showEmptyHero = messages.length === 0;

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      <header className={cn("sticky top-[-25px] z-10 bg-background shrink-0 border-b border-white/[0.06] pb-3 pt-1")}>
        <div className="w-full">
          <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            AI Agent
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Ask about inventory, sales, revenue, commissions, and dealership performance—powered by
            Hrafn.
          </p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        {showEmptyHero ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-20">
            <div className="flex max-w-lg flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <FontAwesomeIcon icon={faComments} className="h-8 w-8" aria-hidden />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                How can I help you today?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                I&apos;m your Hrafn AI assistant. Start below or pick a prompt.
              </p>
              <div className="mt-10 flex w-full max-w-md flex-col gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={!user || sending}
                    onClick={() => {
                      setInput(prompt);
                      textareaRef.current?.focus();
                    }}
                    className={cn(
                      "rounded-2xl bg-white/[0.06] px-4 py-3.5 text-left text-sm text-foreground transition-colors",
                      "hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      "disabled:pointer-events-none disabled:opacity-50",
                    )}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full pt-4 sm:pt-6 pb-12">
            <ul className="flex flex-col" role="log" aria-live="polite" aria-relevant="additions">
              {messages.map((m, i) => (
                <li key={m.id} className="group">
                  {m.role === "assistant" ? (
                    <div
                      className={cn(
                        "flex gap-3.5 py-6 sm:gap-4",
                        i > 0 && "border-t border-white/[0.06]",
                      )}
                    >
                      <div
                        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary ring-1 ring-white/10"
                        aria-hidden
                      >
                        <FontAwesomeIcon icon={faRobot} className="h-4 w-4" />
                      </div>
                      <div className="relative min-w-0 flex-1 pt-0.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Hrafn AI
                          </div>
                          <button
                            type="button"
                            className={cn(
                              "absolute right-3 top-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-opacity",
                              copiedMessageId === m.id && "opacity-100",
                              copiedMessageId !== m.id &&
                              (touchFriendlyUi
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"),
                              "hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            )}
                            aria-label={
                              copiedMessageId === m.id
                                ? "Copied to clipboard"
                                : "Copy assistant reply"
                            }
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => copyToClipboard(m.content, m.id)}
                          >
                            <FontAwesomeIcon
                              icon={suppressCopyHoverMessageId === m.id ? faCheck : faCopy}
                              className={cn(
                                "h-3.5 w-3.5",
                                suppressCopyHoverMessageId === m.id && "text-emerald-400",
                              )}
                            />
                          </button>
                        </div>
                        <div className="text-[15px] leading-7 text-foreground/95">
                          {renderMessageContent(m.content)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4">
                      <div className="relative ml-auto w-full rounded-2xl bg-white/[0.06] px-4 pb-3.5 pt-3 text-left text-[15px] leading-7 text-primary-foreground shadow-sm sm:max-w-lg sm:rounded-3xl sm:px-5 sm:py-4">
                        <button
                          type="button"
                          className={cn(
                            "absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground transition-opacity sm:right-3 sm:top-3",
                            copiedMessageId === m.id && "opacity-100",
                            copiedMessageId !== m.id &&
                              (touchFriendlyUi
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"),
                            "hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          )}
                          aria-label={
                            copiedMessageId === m.id ? "Copied to clipboard" : "Copy your message"
                          }
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => copyToClipboard(m.content, m.id)}
                        >
                          <FontAwesomeIcon
                            icon={suppressCopyHoverMessageId === m.id ? faCheck : faCopy}
                            className={cn(
                              "h-3.5 w-3.5",
                              suppressCopyHoverMessageId === m.id && "text-foreground",
                            )}
                          />
                        </button>
                        <div className="pr-8">{renderMessageContent(m.content)}</div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div ref={endRef} className="h-px w-full shrink-0" aria-hidden />
      </div>

      {/* Sticky in document flow; scroll happens on layout <main id="console-main-scroll" /> */}
      <div className="sticky bottom-[-25px] z-20 mt-auto">
        {!showEmptyHero && !atBottom && (
          <div className="pointer-events-none absolute -top-12 left-0 right-0 flex justify-center">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="hover:cursor-pointer pointer-events-auto h-9 w-9 rounded-full border border-white/10 bg-background shadow-md"
              onClick={scrollToLatest}
              aria-label="Scroll to latest message"
            >
              <FontAwesomeIcon icon={faChevronDown} className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="relative mx-auto w-full max-w-3xl pb-3 bg-background rounded-t-[1.75rem]">
          <div className="flex min-h-[52px] flex-col rounded-[1.75rem] border border-white/10 bg-zinc-800 px-2 py-2 shadow-sm focus-within:border-white/20 focus-within:ring-1 focus-within:ring-primary/35 sm:min-h-[56px] sm:px-3 sm:py-2.5">
            <div className="relative flex min-w-0 flex-1 items-end gap-1.5 sm:gap-2">
              <div className="chat-composer-scroll max-h-[200px] min-h-[40px] min-w-0 flex-1 overflow-y-auto pr-12 sm:min-h-[44px]">
                <textarea
                  ref={textareaRef}
                  id="chatMessage"
                  name="chatMessage"
                  rows={1}
                  className="min-h-[40px] w-full resize-none overflow-hidden bg-transparent py-2.5 pl-1 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 sm:min-h-[44px] sm:py-3"
                  placeholder={user ? "Message Hrafn AI…" : "Please sign in to chat"}
                  disabled={!user || sending}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  onWheel={(e) => {
                    const wrap = e.currentTarget.parentElement;
                    if (!wrap || wrap.scrollHeight <= wrap.clientHeight) return;
                    wrap.scrollTop += e.deltaY;
                    e.preventDefault();
                  }}
                  aria-label="Message input"
                />
              </div>
              <Button
                type="button"
                size="icon"
                className="
                  absolute 
                  bottom-1.5 
                  right-1.5 
                  h-9 
                  w-9 
                  shrink-0 
                  rounded-full 
                  shadow-md sm:bottom-2 sm:right-2 bg-white/[0.06] hover:bg-white/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={sendMessage}
                disabled={!user || sending || !input.trim()}
                aria-label={sending ? "Sending" : "Send message"}
              >
                <FontAwesomeIcon
                  icon={sending ? faCircleNotch : faArrowUp}
                  className={cn("h-4 w-4", sending && "animate-spin")}
                />
              </Button>
            </div>
          </div>
          <div className="px-3 pt-3 flex justify-center gap-2">
            <span>If AI agent makes any mistake, please contact me on <a href="mailto:support@hrafn.com" className="text-primary hover:underline">support@hrafn.com</a></span>  
          </div>
        </div>
      </div>
    </div>
  );
}
