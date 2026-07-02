"use client";

import { ArrowLeft, Bell, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { NotificationRecord } from "@/lib/notifications/service";

type NotificationsPayload = {
  error?: string;
  notifications?: NotificationRecord[];
  unreadCount?: number;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [pendingNotificationId, setPendingNotificationId] = useState<
    string | null
  >(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json().catch(() => null)) as
          | NotificationsPayload
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load notifications.");
        }

        if (isMounted) {
          setNotifications(payload?.notifications ?? []);
          setUnreadCount(payload?.unreadCount ?? 0);
          setStatus("ready");
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load notifications.",
          );
          setStatus("error");
        }
      }
    }

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  async function markRead(notification: NotificationRecord) {
    if (notification.isRead) {
      return;
    }

    setPendingNotificationId(notification.id);
    setError("");

    try {
      const response = await fetch(
        `/api/notifications/${notification.id}/read`,
        { method: "POST" },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Notification could not be updated.");
      }

      setNotifications((currentNotifications) =>
        currentNotifications.map((currentNotification) =>
          currentNotification.id === notification.id
            ? { ...currentNotification, isRead: true }
            : currentNotification,
        ),
      );
      setUnreadCount((currentCount) => Math.max(0, currentCount - 1));
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "Notification could not be updated.",
      );
    } finally {
      setPendingNotificationId(null);
    }
  }

  async function markAllRead() {
    setIsMarkingAllRead(true);
    setError("");

    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Notifications could not be updated.");
      }

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          isRead: true,
        })),
      );
      setUnreadCount(0);
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : "Notifications could not be updated.",
      );
    } finally {
      setIsMarkingAllRead(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
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
              <Bell size={16} />
              Notifications
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Updates
              {unreadCount > 0 ? (
                <span className="ml-2 rounded-md bg-[#f6c66f] px-2 py-1 text-sm font-bold text-[#17201b]">
                  {unreadCount}
                </span>
              ) : null}
            </h1>
          </div>

          <button
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6] disabled:opacity-60"
            disabled={isMarkingAllRead || unreadCount === 0}
            onClick={markAllRead}
            type="button"
          >
            {isMarkingAllRead ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            Mark all read
          </button>
        </header>

        {error ? (
          <p className="mt-4 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]">
            {error}
          </p>
        ) : null}

        {status === "loading" ? <NotificationsLoadingState /> : null}
        {status === "error" ? (
          <NotificationsErrorState message={error} />
        ) : null}
        {status === "ready" && notifications.length === 0 ? (
          <NotificationsEmptyState />
        ) : null}

        {status === "ready" && notifications.length > 0 ? (
          <section className="mt-6 space-y-3">
            {notifications.map((notification) => (
              <article
                className={[
                  "rounded-lg border bg-white p-4 shadow-sm",
                  notification.isRead
                    ? "border-[#d8ded1]"
                    : "border-[#17251f]",
                ].join(" ")}
                key={notification.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <Link className="min-w-0 flex-1" href={notification.href}>
                    <p className="text-sm font-semibold text-[#607265]">
                      {notification.title}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">
                      {notification.message}
                    </h2>
                    <p className="mt-2 text-xs font-semibold uppercase text-[#607265]">
                      {formatDate(notification.createdAt)}
                    </p>
                  </Link>
                  {!notification.isRead ? (
                    <button
                      className="flex h-9 items-center justify-center gap-2 rounded-md bg-[#17251f] px-3 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
                      disabled={pendingNotificationId === notification.id}
                      onClick={() => markRead(notification)}
                      type="button"
                    >
                      {pendingNotificationId === notification.id ? (
                        <LoaderCircle className="animate-spin" size={15} />
                      ) : (
                        <Check size={15} />
                      )}
                      Read
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function NotificationsLoadingState() {
  return (
    <section className="mt-6 space-y-3">
      {[1, 2, 3].map((item) => (
        <div
          className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm"
          key={item}
        >
          <div className="h-4 w-28 rounded-md bg-[#e2e6dc]" />
          <div className="mt-3 h-6 w-80 max-w-full rounded-md bg-[#e2e6dc]" />
          <div className="mt-3 h-3 w-20 rounded-md bg-[#e2e6dc]" />
        </div>
      ))}
    </section>
  );
}

function NotificationsErrorState({ message }: { message: string }) {
  return (
    <section className="mt-6 rounded-lg border border-[#ef8f7a] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#8a3325]">
        Notifications could not load
      </p>
      <p className="mt-3 text-sm leading-6 text-[#34443a]">{message}</p>
    </section>
  );
}

function NotificationsEmptyState() {
  return (
    <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#607265]">No updates yet</p>
      <h2 className="mt-1 text-xl font-semibold">
        Important activity will stay easy to review.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
        Likes, mutual likes, conversation starts, and new messages will appear
        here. Push and email notifications are intentionally off in this build.
      </p>
      <Link
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
        href="/"
      >
        Open discovery
      </Link>
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
