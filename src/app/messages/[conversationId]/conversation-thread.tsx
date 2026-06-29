"use client";

import {
  ArrowLeft,
  Flag,
  LoaderCircle,
  Send,
  ShieldOff,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  ConversationMessage,
  ConversationThread as ConversationThreadPayload,
} from "@/lib/messaging/service";

type ApiErrorPayload = {
  error?: string;
  issues?: Array<{
    message?: string;
  }>;
};

export default function ConversationThread({
  conversationId,
}: {
  conversationId: string;
}) {
  const [thread, setThread] = useState<ConversationThreadPayload | null>(null);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [pendingAction, setPendingAction] = useState<
    "block" | "report" | "send" | null
  >(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadThread() {
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/messages`,
          {
            cache: "no-store",
            headers: { Accept: "application/json" },
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | (ConversationThreadPayload & ApiErrorPayload)
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load conversation.");
        }

        if (isMounted && payload) {
          setThread(payload);
          setStatus("ready");
        }

        await fetch(`/api/conversations/${conversationId}/read`, {
          method: "POST",
        });
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load conversation.",
          );
          setStatus("error");
        }
      }
    }

    loadThread();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  const participant = thread?.conversation.otherParticipants[0] ?? null;
  const latestReportableMessage = useMemo(
    () =>
      [...(thread?.messages ?? [])]
        .reverse()
        .find((conversationMessage) => !conversationMessage.isMine) ?? null,
    [thread?.messages],
  );

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!body.trim()) {
      return;
    }

    setPendingAction("send");
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          body: JSON.stringify({ body }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { message?: ConversationMessage }
        | ApiErrorPayload
        | null;

      if (!response.ok || !payload || !("message" in payload)) {
        throw new Error(getActionFailureMessage(payload, "Message was not sent."));
      }

      const sentMessage = payload.message;

      if (!sentMessage) {
        throw new Error("Message was not sent.");
      }

      setThread((currentThread) =>
        currentThread
          ? {
              ...currentThread,
              messages: [...currentThread.messages, sentMessage],
            }
          : currentThread,
      );
      setBody("");
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Message was not sent.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function blockParticipant() {
    if (!participant) {
      return;
    }

    setPendingAction("block");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/profile/block", {
        body: JSON.stringify({
          profileId: participant.profileId,
          reason: "Conversation safety action",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getActionFailureMessage(payload, "Profile was not blocked."));
      }

      setMessage(`${participant.name} was blocked.`);
    } catch (blockError) {
      setError(
        blockError instanceof Error
          ? blockError.message
          : "Profile was not blocked.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function reportLatestMessage() {
    if (!latestReportableMessage) {
      setError("There is no incoming message to report yet.");
      return;
    }

    setPendingAction("report");
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/messages/${latestReportableMessage.id}/report`,
        {
          body: JSON.stringify({
            details: "Reported from the conversation page.",
            reason: "Conversation safety concern",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getActionFailureMessage(payload, "Message was not reported."));
      }

      setMessage("Message reported for review.");
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Message was not reported.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-4xl flex-col">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/messages"
            >
              <ArrowLeft size={16} />
              Messages
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#17251f] text-white">
                <UserRound size={19} />
              </span>
              <div>
                <h1 className="text-2xl font-semibold">
                  {participant?.name ?? "Conversation"}
                </h1>
                <p className="mt-1 text-sm text-[#607265]">
                  {participant?.city ?? "Permission-based messaging"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6] disabled:opacity-60"
              disabled={pendingAction === "report"}
              onClick={reportLatestMessage}
              type="button"
            >
              {pendingAction === "report" ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Flag size={16} />
              )}
              Report
            </button>
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#ef8f7a] bg-white px-3 text-sm font-semibold text-[#8a3325] transition hover:bg-[#fff5f1] disabled:opacity-60"
              disabled={!participant || pendingAction === "block"}
              onClick={blockParticipant}
              type="button"
            >
              {pendingAction === "block" ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <ShieldOff size={16} />
              )}
              Block
            </button>
          </div>
        </header>

        {message ? (
          <p className="mt-4 rounded-md border border-[#94c973] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f36]">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]">
            {error}
          </p>
        ) : null}

        {status === "loading" ? <ThreadLoadingState /> : null}
        {status === "error" ? <ThreadErrorState message={error} /> : null}

        {status === "ready" && thread ? (
          <>
            <section className="mt-5 flex-1 space-y-3 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
              {thread.messages.length === 0 ? (
                <div className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-4">
                  <p className="text-sm font-semibold text-[#607265]">
                    No messages yet
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#34443a]">
                    Start with something specific from the profile signals that
                    made this mutual save feel worth exploring.
                  </p>
                </div>
              ) : (
                thread.messages.map((conversationMessage) => (
                  <article
                    className={[
                      "max-w-[82%] rounded-lg px-3 py-2 text-sm leading-6",
                      conversationMessage.isMine
                        ? "ml-auto bg-[#17251f] text-white"
                        : "bg-[#fbfaf4] text-[#34443a]",
                    ].join(" ")}
                    key={conversationMessage.id}
                  >
                    <p className="text-xs font-semibold opacity-75">
                      {conversationMessage.isMine
                        ? "You"
                        : conversationMessage.senderName}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {conversationMessage.body}
                    </p>
                    <p className="mt-1 text-xs opacity-70">
                      {formatTime(conversationMessage.createdAt)}
                    </p>
                  </article>
                ))
              )}
            </section>

            <form
              className="mt-4 rounded-lg border border-[#d8ded1] bg-white p-3 shadow-sm"
              onSubmit={sendMessage}
            >
              <label className="sr-only" htmlFor="message-body">
                Message
              </label>
              <textarea
                className="min-h-24 w-full resize-none rounded-md border border-[#cbd4c6] bg-[#fbfaf4] px-3 py-3 text-sm leading-6 text-[#17201b] outline-none transition placeholder:text-[#7c8b80] focus:border-[#17251f]"
                id="message-body"
                maxLength={1000}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write a thoughtful message"
                value={body}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[#607265]">
                  {body.trim().length}/1000
                </p>
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
                  disabled={pendingAction === "send" || !body.trim()}
                  type="submit"
                >
                  {pendingAction === "send" ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                  Send
                </button>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </main>
  );
}

function ThreadLoadingState() {
  return (
    <section className="mt-5 flex-1 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <div className="space-y-3">
        {[1, 2, 3, 4].map((item) => (
          <div
            className={[
              "h-16 rounded-lg bg-[#e2e6dc]",
              item % 2 === 0 ? "ml-auto w-3/5" : "w-4/5",
            ].join(" ")}
            key={item}
          />
        ))}
      </div>
    </section>
  );
}

function ThreadErrorState({ message }: { message: string }) {
  return (
    <section className="mt-5 rounded-lg border border-[#ef8f7a] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#8a3325]">
        Conversation could not load
      </p>
      <p className="mt-3 text-sm leading-6 text-[#34443a]">{message}</p>
    </section>
  );
}

function getActionFailureMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const actionPayload = payload as ApiErrorPayload;
  const firstIssue = actionPayload.issues?.[0]?.message;

  return [actionPayload.error, firstIssue].filter(Boolean).join(" ") || fallback;
}

function formatTime(value: string) {
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
