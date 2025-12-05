"use client";

import { useEffect, useState, useRef } from "react";
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
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadChats();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (showChatDialog === true && selectedChat !== null && selectedChat.id) {
      loadMessages(selectedChat.id);
    } else if (showChatDialog === false) {
      setSelectedChat(null);
      setMessages([]);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [showChatDialog, selectedChat]);

  const loadChats = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      const response = await fetch("/api/inbox", { signal });
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats || []);
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
  };

  const loadMessages = async (chatId: string) => {
    try {
      setGetMessagesLoading(true);
      const response = await fetch(`/api/inbox/${chatId}/messages`);
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
      loadChats();
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

      // Add message to local state
      setMessages((prev) => [...prev, data.message]);
      loadChats(); // Refresh chat list to update last message
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Chat Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="pb-0">
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
          <DialogFooter className="px-0">
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
                  : "cursor-pointer"
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
      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog} className="lg:max-w-4xl! max-w-[95vw]!">
        <DialogContent className="flex flex-col">
          <div className="flex items-center justify-between border-b border-white/40">
            <DialogHeader className="px-0">
              <DialogTitle className="w-full text-2xl font-semibold">
                {selectedChat?.subject}
              </DialogTitle>
            </DialogHeader>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChatDialog(false)}
              className="h-6 w-6 p-0 cursor-pointer hover:bg-red-500/20"
            >
              <FontAwesomeIcon icon={faX} className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 py-4 min-h-[300px] max-h-[500px]">
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
          <div className="flex items-end gap-2 pt-4 border-t border-white/40">
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
                  : "cursor-pointer"
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
