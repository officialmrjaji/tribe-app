"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";

type NotificationsPayload = {
  unreadCount?: number;
};

export function NotificationBadge() {
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?limit=1", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | NotificationsPayload
        | null;

      if (response.ok) {
        setUnreadCount(payload?.unreadCount ?? 0);
      }
    } catch {
      // Keep the last known count; the fallback will retry.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUnreadCount();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadUnreadCount]);

  useRealtimeInvalidation({
    events: ["notifications"],
    onInvalidate: loadUnreadCount,
  });

  if (unreadCount === 0) {
    return null;
  }

  return (
    <span className="ml-auto rounded-md bg-[#f6c66f] px-1.5 py-0.5 text-[11px] font-bold text-[#17201b]">
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  );
}
