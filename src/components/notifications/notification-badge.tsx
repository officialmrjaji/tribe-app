"use client";

import { useEffect, useState } from "react";

type NotificationsPayload = {
  unreadCount?: number;
};

export function NotificationBadge() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadUnreadCount() {
      try {
        const response = await fetch("/api/notifications?limit=1", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json().catch(() => null)) as
          | NotificationsPayload
          | null;

        if (isMounted && response.ok) {
          setUnreadCount(payload?.unreadCount ?? 0);
        }
      } catch {
        if (isMounted) {
          setUnreadCount(0);
        }
      }
    }

    loadUnreadCount();

    return () => {
      isMounted = false;
    };
  }, []);

  if (unreadCount === 0) {
    return null;
  }

  return (
    <span className="ml-auto rounded-md bg-[#f6c66f] px-1.5 py-0.5 text-[11px] font-bold text-[#17201b]">
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  );
}
