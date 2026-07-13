"use client";

import {
  Bell,
  Heart,
  MessageCircle,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { NotificationBadge } from "@/components/notifications/notification-badge";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";

type ConversationsPayload = {
  conversations?: Array<{
    unreadCount?: number;
  }>;
};

const primaryDestinations = [
  {
    href: "/",
    icon: Users,
    key: "people",
    label: "People",
    match: ["/", "/discover", "/profiles", "/voice"],
  },
  {
    href: "/explore",
    icon: Heart,
    key: "connections",
    label: "Connections",
    match: ["/explore", "/saved", "/passed"],
  },
  {
    href: "/messages",
    icon: MessageCircle,
    key: "chats",
    label: "Chats",
    match: ["/messages"],
  },
  {
    href: "/square",
    icon: Sparkles,
    key: "square",
    label: "Square",
    match: ["/square"],
  },
  {
    href: "/me",
    icon: UserRound,
    key: "me",
    label: "Me",
    match: [
      "/me",
      "/profile",
      "/settings",
      "/safety",
      "/premium",
      "/ai",
      "/admin",
      "/feedback",
    ],
  },
] as const;

const hiddenPrefixes = ["/beta", "/onboarding", "/sign-in", "/sign-up"] as const;

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function NavigationFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const shouldHideNavigation = hiddenPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (shouldHideNavigation) {
    return <>{children}</>;
  }

  return (
    <>
      <PrimaryNavigation pathname={pathname} />
      <div className="min-h-screen pb-20 lg:pb-0 lg:pl-[236px]">
        {children}
      </div>
    </>
  );
}

function PrimaryNavigation({ pathname }: { pathname: string }) {
  const chatUnreadCount = useChatUnreadCount();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] border-r border-[#d8ded1] bg-[#17251f] px-4 py-5 text-[#f7f4e9] lg:flex lg:flex-col">
        <div>
          <p className="text-xs font-medium uppercase text-[#acc7bc]">Tribe</p>
          <h1 className="mt-1 text-2xl font-semibold">TribeApp</h1>
          <p className="mt-2 text-sm leading-5 text-[#cddbd4]">
            Personality-first social discovery.
          </p>
        </div>

        <nav className="mt-7 space-y-2" aria-label="Primary navigation">
          {primaryDestinations.map((item) => (
            <NavigationLink
              chatUnreadCount={chatUnreadCount}
              item={item}
              key={item.key}
              pathname={pathname}
            />
          ))}
        </nav>
      </aside>

      <Link
        aria-label="Notifications"
        className="fixed right-4 top-4 z-50 flex h-10 min-w-10 items-center justify-center gap-1 rounded-md border border-[#d8ded1] bg-white px-2 text-[#17251f] shadow-sm transition hover:border-[#9dad9f] hover:bg-[#fbfaf4]"
        href="/notifications"
      >
        <Bell size={18} />
        <NotificationBadge />
      </Link>

      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[#d8ded1] bg-white px-2 py-2 text-[#607265] shadow-[0_-10px_30px_rgba(23,32,27,0.08)] lg:hidden"
      >
        {primaryDestinations.map((item) => (
          <MobileNavigationLink
            chatUnreadCount={chatUnreadCount}
            item={item}
            key={item.key}
            pathname={pathname}
          />
        ))}
      </nav>
    </>
  );
}

function NavigationLink({
  chatUnreadCount,
  item,
  pathname,
}: {
  chatUnreadCount: number;
  item: {
    href: string;
    icon: LucideIcon;
    key: string;
    label: string;
    match: readonly string[];
  };
  pathname: string;
}) {
  const Icon = item.icon;
  const active = isActivePath(pathname, item.match);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
        active
          ? "bg-[#f7f4e9] text-[#17251f]"
          : "text-[#cddbd4] hover:bg-[#22362e] hover:text-white",
      )}
      href={item.href}
    >
      <Icon size={18} />
      <span>{item.label}</span>
      {item.key === "chats" ? (
        <ChatUnreadBadge unreadCount={chatUnreadCount} />
      ) : null}
    </Link>
  );
}

function MobileNavigationLink({
  chatUnreadCount,
  item,
  pathname,
}: {
  chatUnreadCount: number;
  item: {
    href: string;
    icon: LucideIcon;
    key: string;
    label: string;
    match: readonly string[];
  };
  pathname: string;
}) {
  const Icon = item.icon;
  const active = isActivePath(pathname, item.match);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold transition",
        active ? "bg-[#17251f] text-white" : "hover:bg-[#f3f0e6]",
      )}
      href={item.href}
    >
      <span className="relative">
        <Icon size={18} />
        {item.key === "chats" ? (
          <ChatUnreadBadge compact unreadCount={chatUnreadCount} />
        ) : null}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

function useChatUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadChats = useCallback(async () => {
    try {
      const response = await fetch("/api/conversations", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | ConversationsPayload
        | null;

      if (response.ok) {
        const nextCount = (payload?.conversations ?? []).reduce(
          (total, conversation) => total + (conversation.unreadCount ?? 0),
          0,
        );

        setUnreadCount(nextCount);
      }
    } catch {
      // Keep the last known count; the fallback will retry.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUnreadChats();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadUnreadChats]);

  useRealtimeInvalidation({
    events: ["connections", "messages"],
    onInvalidate: loadUnreadChats,
  });

  return unreadCount;
}

function ChatUnreadBadge({
  compact = false,
  unreadCount,
}: {
  compact?: boolean;
  unreadCount: number;
}) {
  if (unreadCount === 0) {
    return null;
  }

  if (compact) {
    return (
      <span className="absolute -right-2 -top-2 rounded-full bg-[#f6c66f] px-1 text-[10px] font-bold leading-4 text-[#17201b]">
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>
    );
  }

  return (
    <span className="ml-auto rounded-md bg-[#f6c66f] px-1.5 py-0.5 text-[11px] font-bold text-[#17201b]">
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  );
}

function isActivePath(pathname: string, matches: readonly string[]) {
  return matches.some((match) => {
    if (match === "/") {
      return pathname === "/";
    }

    return pathname === match || pathname.startsWith(`${match}/`);
  });
}
