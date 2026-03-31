"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  faEnvelope,
  faEnvelopeOpen,
  faClock,
  faCheckCircle,
  faUser,
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
  user: {
    id: string;
    name: string;
    email: string;
  };
  admin: {
    id: string;
    name: string;
    email: string;
  } | null;
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

type TabType = "new" | "my";

type StatusFilter = "all" | "active" | "closed";

export default function AdminInboxPage() {
  const [activeTab, setActiveTab] = useState<TabType>("new");
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [getMessagesLoading, setGetMessagesLoading] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  /** Which chat is currently being accepted (spinner only on that row / modal). */
  const [acceptingChatId, setAcceptingChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  /** Primary list fetch; silent background refreshes use a separate controller so they do not abort the visible load. */
  const loadChatsAbortRef = useRef<AbortController | null>(null);
  const silentLoadChatsAbortRef = useRef<AbortController | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  /** True after mark-read succeeded for the open chat; skip duplicate POSTs until new messages from the user. */
  const readAllAckRef = useRef(false);
  const lastSentMessageIdRef = useRef<string | null>(null);

  const markReadIfNeeded = useCallback(async (chatId: string) => {
    if (readAllAckRef.current) return;
    try {
      const res = await fetch(`/api/admin/inbox/${chatId}/mark-read`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { skipped?: boolean };
      if (res.ok && !data.skipped) readAllAckRef.current = true;
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [activeTab, statusFilter, searchQuery]);

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
      // Use separate routes for new and my chats
      const baseRoute = activeTab === "new" ? "/api/admin/inbox/new" : "/api/admin/inbox/my";

      // Build query parameters
      const params = new URLSearchParams();
      if (activeTab === "my" && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      params.append("page", pageForFetch.toString());
      params.append("pageSize", pageSize.toString());

      const route = `${baseRoute}?${params.toString()}`;

      const response = await fetch(route, { signal });
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.totalCount || 0);
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
  }, [activeTab, statusFilter, searchQuery, currentPage, pageSize]);

  const loadMessages = useCallback(async (chatId: string, options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    try {
      if (!silent) setGetMessagesLoading(true);
      const response = await fetch(`/api/admin/inbox/${chatId}/messages`);
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
    if (showChatDialog && selectedChat) {
      selectedChatIdRef.current = selectedChat.id;
      loadMessages(selectedChat.id);
    } else if (!showChatDialog) {
      selectedChatIdRef.current = null;
      readAllAckRef.current = false;
    }
  }, [showChatDialog, selectedChat?.id, loadMessages]);

  useEffect(() => {
    if (showChatDialog && selectedChat?.admin) {
      void markReadIfNeeded(selectedChat.id);
    }
  }, [showChatDialog, selectedChat?.id, selectedChat?.admin, markReadIfNeeded]);

  useEffect(() => {
    if (!showChatDialog || getMessagesLoading) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = messagesScrollRef.current;
        if (el) {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }
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
        loadChats({ silent: true });
      }, 4000);
    };

    const handleSseData = (raw: string) => {
      if (stopped) return;
      let payload: { type?: string; chatId?: string; senderType?: string };
      try {
        payload = JSON.parse(raw) as { type?: string; chatId?: string; senderType?: string };
      } catch {
        return;
      }

      const t = payload.type;
      if (t === "read_state_updated") {
        loadChats({ silent: true });
        return;
      }
      if (t === "connected") {
        return;
      }
      if (t === "message_created") {
        loadChats({ silent: true });
        const openId = selectedChatIdRef.current;
        if (openId && payload.chatId === openId && payload.senderType === "user") {
          readAllAckRef.current = false;
          loadMessages(openId, { silent: true });
          void markReadIfNeeded(openId);
        }
        return;
      }
      loadChats();
    };

    try {
      es = new EventSource("/api/admin/inbox/events");
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
  }, [markReadIfNeeded, loadChats, loadMessages]);

  const handleAcceptChat = async (chatId: string) => {
    setAcceptingChatId(chatId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/inbox/${chatId}/accept`, {
        method: "PUT",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept chat");
        return;
      }

      setSuccess("Chat accepted successfully");
      if (data.chat?.id) {
        const c = data.chat as Chat;
        setSelectedChat((prev) =>
          prev?.id === c.id
            ? {
                ...prev,
                status: c.status,
                admin: c.admin,
                messages: c.messages ?? prev.messages,
                _count: c._count ?? prev._count,
                unreadCount: prev.unreadCount,
              }
            : prev,
        );
      }
      loadChats({ silent: true });
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setAcceptingChatId(null);
    }
  };

  const handleOpenChat = async (chat: Chat) => {
    setSelectedChat(chat);
    setShowChatDialog(true);
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !selectedChat.admin || selectedChat.status === "closed" || !messageInput.trim() || sending)
      return;

    setSending(true);
    const messageContent = messageInput.trim();
    setMessageInput("");

    try {
      const response = await fetch(`/api/admin/inbox/${selectedChat.id}/messages`, {
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

      if (data.message) {
        const msg = data.message as Message;
        lastSentMessageIdRef.current = msg.id;
        setMessages((prev) => [...prev, msg]);
        setChats((prev) =>
          patchChatListAfterMessage(prev, selectedChat.id, {
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
          }),
        );
        setSelectedChat((prev) =>
          prev && prev.id === selectedChat.id
            ? patchChatListAfterMessage([prev], selectedChat.id, {
                id: msg.id,
                content: msg.content,
                createdAt: msg.createdAt,
              })[0]
            : prev,
        );
      }
    } catch (err) {
      setError("Network error. Please try again.");
      setMessageInput(messageContent);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (chatId: string, status: "opened" | "accepted" | "closed") => {
    try {
      const response = await fetch(`/api/admin/inbox/${chatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        loadChats({ silent: true });
        if (selectedChat && selectedChat.id === chatId) {
          setSelectedChat({ ...selectedChat, status });
        }
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const getChatPreview = (chat: Chat) => {
    if (chat.messages && chat.messages.length > 0) {
      return chat.messages[0].content;
    }
    return "No messages yet";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "opened":
        return (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
            Opened
          </span>
        );
      case "accepted":
        return (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-500/20 text-blue-600 dark:text-blue-400">
            Accepted
          </span>
        );
      case "closed":
        return (
          <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-500/20 text-gray-600 dark:text-gray-400">
            Closed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Manage support conversations</p>

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

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex space-x-8">
          <button
            onClick={() => {
              setActiveTab("new");
              setStatusFilter("all");
              setSearchQuery("");
            }}
            className={cn(
              "border-b-2 py-4 px-1 text-sm font-medium transition-colors cursor-pointer",
              activeTab === "new"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            New Chats
          </button>
          <button
            onClick={() => {
              setActiveTab("my");
              setStatusFilter("active");
              setSearchQuery("");
            }}
            className={cn(
              "border-b-2 py-4 px-1 text-sm font-medium transition-colors cursor-pointer",
              activeTab === "my"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            My Chats
          </button>
        </nav>
      </div>

      {/* Filters - Only show for "My Chats" tab */}
      {activeTab === "my" && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="cursor-pointer"
              >
                All
              </Button>
              <Button
                variant={statusFilter === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("active")}
                className="cursor-pointer"
              >
                Active
              </Button>
              <Button
                variant={statusFilter === "closed" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("closed")}
                className="cursor-pointer"
              >
                Closed
              </Button>
            </div>
          </div>

          {/* Search Box */}
          <div className="w-full sm:w-auto sm:min-w-[300px] sm:max-w-lg">
            <Input
              id="search"
              name="search"
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
        </div>
      ) : chats.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center pt-10">
            <FontAwesomeIcon icon={faEnvelope} size="3x" className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {activeTab === "new"
                ? "No new chats available."
                : "You don't have any assigned chats."}
            </p>
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
              <CardContent className="p-4 pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{chat.subject}</h3>
                      {getStatusBadge(chat.status)}
                    </div>
                    <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                      <FontAwesomeIcon icon={faUser} className="h-3 w-3" />
                      <span>
                        {chat.user.name} ({chat.user.email})
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {getChatPreview(chat)}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        <FontAwesomeIcon icon={faClock} className="h-3 w-3 mr-1" />
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </span>
                      {activeTab === "my" && chat.unreadCount > 0 ? (
                        <span className="text-primary font-medium">
                          {chat.unreadCount} unread
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {activeTab === "new" && (
                    <Button
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleAcceptChat(chat.id);
                      }}
                      disabled={acceptingChatId !== null}
                      size="sm"
                      className={cn(
                        "flex-shrink-0",
                        acceptingChatId !== null ? "cursor-not-allowed" : "cursor-pointer",
                      )}
                    >
                      {acceptingChatId === chat.id ? (
                        <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 mr-2" />
                      )}
                      Accept
                    </Button>
                  )}
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

      {/* Chat Dialog */}
      <Dialog
        open={showChatDialog}
        onOpenChange={setShowChatDialog}
        className="lg:max-w-4xl! max-w-[95vw]! flex max-h-[90vh] flex-col overflow-hidden"
      >
        <DialogContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-white/40 bg-background px-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="w-full text-2xl font-semibold">
                {selectedChat?.subject}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChatDialog(false)}
                className="h-6 w-6 p-0 cursor-pointer hover:bg-red-500/20"
              >
                <FontAwesomeIcon icon={faX} className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <DialogDescription>
                <span>
                  <FontAwesomeIcon icon={faUser} className="h-3 w-3 mr-1" />
                  {selectedChat?.user.name} ({selectedChat?.user.email})
                </span>
              </DialogDescription>
              {selectedChat && getStatusBadge(selectedChat.status)}
            </div>
          </DialogHeader>
          <div
            ref={messagesScrollRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
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
                    message.senderType === "admin" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2",
                      message.senderType === "admin"
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
          <div className="shrink-0 space-y-2 border-t border-white/40 pt-4">
            {selectedChat && !selectedChat.admin && (
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>Accept this chat to send messages.</span>
                <Button
                  size="sm"
                  onClick={() => handleAcceptChat(selectedChat.id)}
                  disabled={acceptingChatId !== null}
                  className={cn(
                    "cursor-pointer shrink-0",
                    acceptingChatId !== null && "cursor-not-allowed",
                  )}
                >
                  {acceptingChatId === selectedChat.id ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                      Accepting…
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faCheckCircle} className="h-4 w-4 mr-2" />
                      Accept chat
                    </>
                  )}
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedChat && handleUpdateStatus(selectedChat.id, "closed")}
                disabled={selectedChat?.status === "closed"}
                className={cn(
                  selectedChat?.status === "closed" ? "cursor-not-allowed" : "cursor-pointer",
                )}
              >
                Close Chat
              </Button>
              {selectedChat?.status === "closed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedChat && handleUpdateStatus(selectedChat.id, "accepted")}
                  className="cursor-pointer"
                >
                  Reopen Chat
                </Button>
              )}
            </div>
            <div className="flex items-end gap-2">
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
                placeholder={
                  selectedChat?.admin
                    ? "Type your message..."
                    : "Accept the chat above to reply…"
                }
                disabled={sending || selectedChat?.status === "closed" || !selectedChat?.admin}
                rows={2}
                className="flex-1 min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
              <Button
                onClick={handleSendMessage}
                disabled={
                  sending ||
                  selectedChat?.status === "closed" ||
                  !selectedChat?.admin ||
                  !messageInput.trim()
                }
                className={cn(
                  sending ||
                    selectedChat?.status === "closed" ||
                    !selectedChat?.admin ||
                    !messageInput.trim()
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
