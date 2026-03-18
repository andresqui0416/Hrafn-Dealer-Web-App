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
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

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
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
  }, [activeTab, statusFilter, searchQuery]);

  const loadChats = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
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
      params.append("page", currentPage.toString());
      params.append("pageSize", pageSize.toString());

      const route = `${baseRoute}?${params.toString()}`;

      const response = await fetch(route, { signal });
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.totalCount || 0);
        }
      } else {
        if (!signal.aborted) {
          setError("Failed to load chats");
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (!signal.aborted) {
        setError("Failed to load chats");
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [activeTab, statusFilter, searchQuery, currentPage, pageSize]);

  useEffect(() => {
    loadChats();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadChats]);

  useEffect(() => {
    if (showChatDialog && selectedChat) {
      loadMessages(selectedChat.id);
    }
  }, [showChatDialog, selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const loadMessages = async (chatId: string) => {
    try {
      setGetMessagesLoading(true);
      const response = await fetch(`/api/admin/inbox/${chatId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setGetMessagesLoading(false);
    }
  };

  const handleAcceptChat = async (chatId: string) => {
    setAccepting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/inbox/${chatId}/accept`, {
        method: "PUT",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept chat");
        setAccepting(false);
        return;
      }

      setSuccess("Chat accepted successfully");
      loadChats(); // Refresh to move chat from "new" to "my"
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setAccepting(false);
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

      // Response format: { status: "Message sent successfully", message }
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
      loadChats();
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
        loadChats();
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
                      <span>
                        {chat._count.messages} message{chat._count.messages !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  {activeTab === "new" && (
                    <Button
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleAcceptChat(chat.id);
                      }}
                      disabled={accepting}
                      size="sm"
                      className={cn(
                        "flex-shrink-0",
                        accepting ? "cursor-not-allowed" : "cursor-pointer",
                      )}
                    >
                      {accepting ? (
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

      {/* Pagination */}
      {!loading && chats.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount} chats
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={cn(currentPage === 1 ? "cursor-not-allowed" : "cursor-pointer")}
            >
              <FontAwesomeIcon icon={faChevronLeft} className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="cursor-pointer min-w-[40px]"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={cn(currentPage === totalPages ? "cursor-not-allowed" : "cursor-pointer")}
            >
              Next
              <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Chat Dialog */}
      <Dialog
        open={showChatDialog}
        onOpenChange={setShowChatDialog}
        className="lg:max-w-4xl! max-w-[95vw]!"
      >
        <DialogContent className="flex flex-col">
          <DialogHeader className="px-0 border-b border-white/40 sticky top-0 bg-background">
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
          <div className="flex-1 overflow-y-auto space-y-4 py-4 min-h-[300px] max-h-[350px] overflow-y-auto px-4">
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
          <div className="space-y-2 pt-4 border-t border-white/40">
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
                placeholder="Type your message..."
                disabled={sending || selectedChat?.status === "closed"}
                rows={2}
                className="flex-1 min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
              <Button
                onClick={handleSendMessage}
                disabled={sending || selectedChat?.status === "closed" || !messageInput.trim()}
                className={cn(
                  sending || selectedChat?.status === "closed" || !messageInput.trim()
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
