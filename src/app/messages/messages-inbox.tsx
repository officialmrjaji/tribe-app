"use client";

import {
  ArrowLeft,
  Bell,
  Heart,
  LoaderCircle,
  MessageCircle,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ConversationSummary } from "@/lib/messaging/service";

type ConversationsPayload = {
  conversations?: ConversationSummary[];
  error?: string;
};

export default function MessagesInbox() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [status, setStatus] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [error, setError] = useState("");
  const unreadTotal = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadConversations() {
      try {
        setError("");
        const response = await fetch("/api/conversations", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | ConversationsPayload
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load conversations.");
        }

        if (isMounted) {
          setConversations(payload?.conversations ?? []);
          setStatus("ready");
        }
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load conversations.",
          );
          setStatus("error");
        }
      }
    }

    loadConversations();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    function applyConversationUpdate(conversation: ConversationSummary) {
      setConversations((currentConversations) => {
        const existingConversation = currentConversations.find(
          (currentConversation) => currentConversation.id === conversation.id,
        );
        const nextConversation = existingConversation
          ? {
              ...existingConversation,
              ...conversation,
              unreadCount: conversation.unreadCount,
            }
          : conversation;
        const remainingConversations = currentConversations.filter(
          (currentConversation) => currentConversation.id !== conversation.id,
        );

        return [nextConversation, ...remainingConversations].sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime(),
        );
      });
    }

    function handleConversationUpdate(event: Event) {
      const conversation = (event as CustomEvent<ConversationSummary>).detail;

      if (conversation?.id) {
        applyConversationUpdate(conversation);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== "tribe:lastConversationUpdate" || !event.newValue) {
        return;
      }

      try {
        const payload = JSON.parse(event.newValue) as {
          conversation?: ConversationSummary;
        };

        if (payload.conversation?.id) {
          applyConversationUpdate(payload.conversation);
        }
      } catch {
        // Ignore malformed cross-tab freshness events.
      }
    }

    window.addEventListener("tribe:conversation-updated", handleConversationUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        "tribe:conversation-updated",
        handleConversationUpdate,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/"
            >
              <ArrowLeft size={16} />
              Discovery
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <MessageCircle size={16} />
              Inbox
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Messages
              {unreadTotal > 0 ? (
                <span className="ml-2 rounded-md bg-[#f6c66f] px-2 py-1 text-sm font-bold text-[#17201b]">
                  {unreadTotal}
                </span>
              ) : null}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              Conversations open only after both people like each other.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-2 sm:flex">
            <Link
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/explore?tab=liked"
            >
              <Heart size={16} />
              Liked
            </Link>
            <Link
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/notifications"
            >
              <Bell size={16} />
              Notifications
            </Link>
          </nav>
        </header>

        {status === "loading" ? <InboxLoadingState /> : null}
        {status === "error" ? <InboxErrorState message={error} /> : null}
        {status === "ready" && conversations.length === 0 ? (
          <InboxEmptyState />
        ) : null}

        {status === "ready" && conversations.length > 0 ? (
          <section className="mt-6 space-y-3">
            {conversations.map((conversation) => {
              const participant = conversation.otherParticipants[0];

              return (
                <Link
                  className="block rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm transition hover:border-[#9dad9f]"
                  href={`/messages/${conversation.id}`}
                  key={conversation.id}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#17251f] text-white">
                      <UserRound size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-semibold">
                            {participant?.name ?? "Tribe member"}
                          </h2>
                          <p className="mt-1 text-sm text-[#607265]">
                            {participant?.city ?? "Location open"}
                          </p>
                        </div>
                        {conversation.unreadCount > 0 ? (
                          <span className="rounded-md bg-[#f6c66f] px-2 py-1 text-xs font-bold text-[#17201b]">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 truncate text-sm leading-6 text-[#34443a]">
                        {conversation.lastMessage
                          ? `${conversation.lastMessage.isMine ? "You: " : ""}${
                              conversation.lastMessage.body
                            }`
                          : "No messages yet."}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase text-[#607265]">
                        {formatDate(conversation.updatedAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function InboxLoadingState() {
  return (
    <section className="mt-6 space-y-3">
      <div className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#607265]">
          Loading conversations
        </p>
        <p className="mt-1 text-sm text-[#34443a]">
          Fetching inbox summaries and unread counts.
        </p>
      </div>
      {[1, 2, 3].map((item) => (
        <div
          className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm"
          key={item}
        >
          <div className="flex gap-3">
            <div className="h-12 w-12 rounded-md bg-[#e2e6dc]" />
            <div className="flex-1">
              <div className="h-5 w-40 rounded-md bg-[#e2e6dc]" />
              <div className="mt-3 h-4 w-64 max-w-full rounded-md bg-[#e2e6dc]" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function InboxErrorState({ message }: { message: string }) {
  return (
    <section className="mt-6 rounded-lg border border-[#ef8f7a] bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3325]">
        <LoaderCircle size={16} />
        Messages need attention
      </p>
      <p className="mt-3 text-sm leading-6 text-[#34443a]">{message}</p>
    </section>
  );
}

function InboxEmptyState() {
  return (
    <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#607265]">
        No conversations yet
      </p>
      <h2 className="mt-1 text-xl font-semibold">
        Messaging opens only when interest is mutual.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
        Like profiles that feel aligned. If they like you too, the Message
        button appears in matched profiles. Blocks, incomplete profiles, and
        one-sided likes stay closed for safety.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
          href="/explore?tab=liked"
        >
          Open liked profiles
        </Link>
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
          href="/"
        >
          Return to discovery
        </Link>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}
