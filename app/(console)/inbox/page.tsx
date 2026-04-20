"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faX,
  faPlus,
  faEnvelope,
  faClock,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { patchChatListAfterMessage } from "@/lib/inbox/chat-list-patch";
import { InboxPagination } from "@/components/inbox-pagination";

type Chat = {
  id: string;
  subject: string;
  status: "opened" | "accepted" | "closed";
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    content: string;
    createdAt: string;
  }>;
  _count: {
    messages: number;
  };
  unreadCount: number;
};

type Message = {
  id: string;
  senderId: string;
  senderType: "user" | "admin";
  content: string;
  createdAt: string;
};

export default function InboxPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [getMessagesLoading, setGetMessagesLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const loadChatsAbortRef = useRef<AbortController | null>(null);
  const silentLoadChatsAbortRef = useRef<AbortController | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  /** True after mark-read succeeded for the currently open chat; skip duplicate POSTs until new messages arrive. */
  const readAllAckRef = useRef(false);
  const lastSentMessageIdRef = useRef<string | null>(null);

  const markReadIfNeeded = useCallback(async (chatId: string) => {
    if (readAllAckRef.current) return;
    try {
      const res = await fetch(`/api/inbox/${chatId}/mark-read`, { method: "POST" });
      if (res.ok) readAllAckRef.current = true;
    } catch {
      // best-effort
    }
  }, []);

  const loadChats = useCallback(async (options?: { silent?: boolean; page?: number }) => {
    const silent = options?.silent === true;
    const pageForFetch = options?.page ?? currentPage;
    let controller: AbortController;
    if (silent) {
      silentLoadChatsAbortRef.current?.abort();
      controller = new AbortController();
      silentLoadChatsAbortRef.current = controller;
    } else {
      loadChatsAbortRef.current?.abort();
      silentLoadChatsAbortRef.current?.abort();
      controller = new AbortController();
      loadChatsAbortRef.current = controller;
    }
    const signal = controller.signal;

    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(pageForFetch));
      params.set("pageSize", String(pageSize));
      const response = await fetch(`/api/inbox?${params.toString()}`, { signal });
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages ?? 1);
          setTotalCount(data.pagination.totalCount ?? 0);
          if (typeof data.pagination.page === "number") {
            setCurrentPage(data.pagination.page);
          }
        }
      } else {
        if (!signal.aborted && !silent) {
          setError("Failed to load chats");
        }
      }
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (isAbort) {
        return;
      }
      if (!signal.aborted && !silent) {
        setError("Failed to load chats");
      }
    } finally {
      if (!signal.aborted && !silent) {
        setLoading(false);
      }
    }
  }, [currentPage, pageSize]);

  const loadMessages = useCallback(async (chatId: string, options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    try {
      if (!silent) setGetMessagesLoading(true);
      const response = await fetch(`/api/inbox/${chatId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      if (!silent) setGetMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();

    return () => {
      loadChatsAbortRef.current?.abort();
      silentLoadChatsAbortRef.current?.abort();
    };
  }, [loadChats]);

  useEffect(() => {
    if (showChatDialog === true && selectedChat !== null && selectedChat.id) {
      // Only load messages when opening a different chat (avoid reloading after local UI patches).
      if (selectedChatIdRef.current !== selectedChat.id) {
        selectedChatIdRef.current = selectedChat.id;
        loadMessages(selectedChat.id);
        void markReadIfNeeded(selectedChat.id);
      }
    } else if (showChatDialog === false) {
      setSelectedChat(null);
      setMessages([]);
      selectedChatIdRef.current = null;
      readAllAckRef.current = false;
    }
  }, [showChatDialog, selectedChat, loadMessages, markReadIfNeeded]);

  useEffect(() => {
    if (!showChatDialog || getMessagesLoading) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [showChatDialog, messages.length, getMessagesLoading]);

  useEffect(() => {
    let es: EventSource | null = null;
    let pollInterval: number | null = null;
    let stopped = false;

    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = window.setInterval(() => {
        if (selectedChatIdRef.current) {
          loadMessages(selectedChatIdRef.current, { silent: true });
        }
      }, 4000);
    };

    const handleSseData = (raw: string) => {
      if (stopped) return;
      let payload: { type?: string; chatId?: string; senderType?: string };
      try {
        payload = JSON.parse(raw) as { type?: string; chatId?: string; senderType?: string };
      } catch {
        loadChats({ silent: true });
        return;
      }

      const t = payload.type;
      // read_state_updated follows mark-read; full loadChats() would flash the list loading spinner.
      if (t === "read_state_updated") {
        loadChats({ silent: true });
        return;
      }
      if (t === "connected") {
        return;
      }
      if (t === "chat_created") {
        loadChats({ silent: true });
        return;
      }
      if (t === "message_created") {
        const p = payload as {
          chatId?: string;
          messageId?: string;
          content?: string;
          createdAt?: string;
          senderType?: string;
        };
        const chatId = p.chatId;
        const messageId = p.messageId;
        const content = p.content;
        const createdAt = p.createdAt;
        if (
          chatId &&
          messageId &&
          typeof content === "string" &&
          typeof createdAt === "string"
        ) {
          if (messageId === lastSentMessageIdRef.current) {
            lastSentMessageIdRef.current = null;
          } else {
            const unreadDelta = payload.senderType === "admin" ? 1 : 0;
            const patchOpts = unreadDelta ? { unreadDelta } : undefined;
            setChats((prev) =>
              patchChatListAfterMessage(
                prev,
                chatId,
                {
                  id: messageId,
                  content,
                  createdAt,
                },
                patchOpts,
              ),
            );
            setSelectedChat((prev) =>
              prev && prev.id === chatId
                ? patchChatListAfterMessage(
                    [prev],
                    chatId,
                    {
                      id: messageId,
                      content,
                      createdAt,
                    },
                    patchOpts,
                  )[0]
                : prev,
            );
          }
        }
        const openId = selectedChatIdRef.current;
        if (openId && payload.chatId === openId && payload.senderType === "admin") {
          readAllAckRef.current = false;
          loadMessages(openId, { silent: true });
          void markReadIfNeeded(openId);
        }
        return;
      }
      loadChats({ silent: true });
    };

    try {
      es = new EventSource("/api/inbox/events");
      es.onmessage = (ev) => handleSseData(ev.data);
      es.onerror = () => {
        es?.close();
        es = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      stopped = true;
      es?.close();
      if (pollInterval) window.clearInterval(pollInterval);
    };
  }, [loadChats, loadMessages, markReadIfNeeded]);

  const handleCreateChat = async () => {
    if (!subject.trim() || !content.trim()) {
      setError("Subject and content are required");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), content: content.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create chat");
        setCreating(false);
        return;
      }

      setSuccess("Chat created successfully");
      setSubject("");
      setContent("");
      setShowCreateDialog(false);
      loadChats({ silent: true, page: 1 });
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenChat = async (chat: Chat) => {
    setSelectedChat(chat);
    setShowChatDialog(true);
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !messageInput.trim() || sending) return;

    setSending(true);
    const messageContent = messageInput.trim();
    setMessageInput("");

    try {
      const response = await fetch(`/api/inbox/${selectedChat.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send message");
        setMessageInput(messageContent);
        setSending(false);
        return;
      }

      const msg = data.message as Message;
      const chatPatch = data.chat as { status?: Chat["status"] } | undefined;
      lastSentMessageIdRef.current = msg.id;
      setMessages((prev) => [...prev, msg]);
      setChats((prev) => {
        const next = patchChatListAfterMessage(prev, selectedChat.id, {
          id: msg.id,
          content: msg.content,
          createdAt: msg.createdAt,
        });
        if (!chatPatch?.status) return next;
        const status = chatPatch.status;
        return next.map((c) => (c.id === selectedChat.id ? { ...c, status } : c));
      });
      setSelectedChat((prev) => {
        if (!prev || prev.id !== selectedChat.id) return prev;
        const row = patchChatListAfterMessage([prev], selectedChat.id, {
          id: msg.id,
          content: msg.content,
          createdAt: msg.createdAt,
        })[0];
        return chatPatch?.status ? { ...row, status: chatPatch.status } : row;
      });
    } catch (err) {
      setError("Network error. Please try again.");
      setMessageInput(messageContent);
    } finally {
      setSending(false);
    }
  };

  const getChatPreview = (chat: Chat) => {
    if (chat.messages && chat.messages.length > 0) {
      return chat.messages[0].content;
    }
    return "No messages yet";
  };

  const closedBadge = (
    <span className="shrink-0 rounded-md bg-gray-500/20 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
      Closed
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Inbox</h2>
          <p className="text-sm text-muted-foreground">Manage your support conversations</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="cursor-pointer">
          <FontAwesomeIcon icon={faPlus} className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-500/15 p-3 text-sm text-destructive flex items-center justify-between gap-2">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="h-6 w-6 p-0 cursor-pointer hover:bg-red-500/20"
          >
            <FontAwesomeIcon icon={faX} className="h-3 w-3" />
          </Button>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-500/15 p-3 text-sm text-white flex items-center justify-between gap-2">
          <span>{success}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccess(null)}
            className="h-6 w-6 p-0 cursor-pointer hover:bg-green-500/20"
          >
            <FontAwesomeIcon icon={faX} className="h-3 w-3" />
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
        </div>
      ) : chats.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <FontAwesomeIcon icon={faEnvelope} size="3x" className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No chats yet. Create a new chat to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {chats.map((chat) => (
            <Card
              key={chat.id}
              className="cursor-pointer hover:bg-white/5 transition-colors duration-200"
              onClick={() => handleOpenChat(chat)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{chat.subject}</h3>
                      {chat.status === "closed" ? closedBadge : null}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {getChatPreview(chat)}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        <FontAwesomeIcon icon={faClock} className="h-3 w-3 mr-1" />
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </span>
                      {chat.unreadCount > 0 ? (
                        <span className="text-primary font-medium">
                          {chat.unreadCount} unread
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <InboxPagination
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={setCurrentPage}
      />

      {/* Create Chat Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}
      className="lg:max-w-4xl! max-w-[95vw]! flex max-h-[90vh] flex-col overflow-hidden"
      >
        <DialogContent>
          <DialogHeader className="px-0">
            <DialogTitle>Create New Chat</DialogTitle>
            <DialogDescription>
              Start a new conversation with support. Provide a subject and your initial message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="subject" className="text-sm font-medium">
                Subject <span className="text-destructive">*</span>
              </label>
              <Input
                id="subject"
                name="subject"
                type="text"
                placeholder="Enter subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                disabled={creating}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="content" className="text-sm font-medium">
                Message <span className="text-destructive">*</span>
              </label>
              <textarea
                id="content"
                name="content"
                rows={6}
                placeholder="Enter your message"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                disabled={creating}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter className="px-0 gap-4">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
              className={cn(creating ? "cursor-not-allowed" : "cursor-pointer")}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateChat}
              disabled={creating || !subject.trim() || !content.trim()}
              className={cn(
                creating || !subject.trim() || !content.trim()
                  ? "cursor-not-allowed"
                  : "cursor-pointer",
              )}
            >
              {creating ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Chat"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      <Dialog
        open={showChatDialog}
        onOpenChange={setShowChatDialog}
        className="lg:max-w-4xl! max-w-[95vw]! flex max-h-[90vh] flex-col overflow-hidden"
      >
        <DialogContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div className="flex items-center shrink-0 justify-between gap-3 border-b border-white/40 pb-5 sm:px-6">
            <DialogHeader className="p-0 text-left">
              <div className="flex flex-wrap items-center gap-2 pr-1">
                <DialogTitle className="text-2xl font-semibold">
                  {selectedChat?.subject}
                </DialogTitle>
                {selectedChat?.status === "closed" ? closedBadge : null}
              </div>
            </DialogHeader>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChatDialog(false)}
              className="h-8 w-8 shrink-0 p-0 cursor-pointer hover:bg-red-500/20"
            >
              <FontAwesomeIcon icon={faX} className="h-3 w-3" />
            </Button>
          </div>
          <div
            ref={messagesScrollRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6"
          >
            {getMessagesLoading ? (
              <div className="flex justify-center items-center gap-2 py-10">
                <FontAwesomeIcon icon={faSpinner} size="lg" className="animate-spin" />
                <span>Loading messages...</span>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.senderType === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2",
                      message.senderType === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/5",
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-2">
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex shrink-0 items-end gap-3 border-t border-white/40 px-5 pt-4 pb-5 sm:px-6">
            <textarea
              id="message"
              name="message"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message..."
              disabled={sending || getMessagesLoading}
              rows={2}
              className="flex-1 min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
            <Button
              onClick={handleSendMessage}
              disabled={sending || getMessagesLoading || !messageInput.trim()}
              className={cn(
                sending || getMessagesLoading || !messageInput.trim()
                  ? "cursor-not-allowed"
                  : "cursor-pointer",
              )}
            >
              {sending ? (
                <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" />
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
