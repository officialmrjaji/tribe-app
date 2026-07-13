import {
  ArrowLeft,
  Bell,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { NotificationBadge } from "@/components/notifications/notification-badge";
import type { DiscoveryCollectionProfile } from "@/lib/discovery/service";
import { ProfileCollectionGrid } from "./profile-collection-grid";

type ProfileCollectionPageProps = {
  accentLabel: string;
  description: string;
  emptyBody: string;
  emptyTitle: string;
  eyebrow: string;
  icon: LucideIcon;
  allowMessaging?: boolean;
  profiles: DiscoveryCollectionProfile[];
  restorePassed?: boolean;
  title: string;
};

export function ProfileCollectionPage({
  accentLabel,
  description,
  emptyBody,
  emptyTitle,
  eyebrow,
  icon: Icon,
  allowMessaging = false,
  profiles,
  restorePassed = false,
  title,
}: ProfileCollectionPageProps) {
  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/"
            >
              <ArrowLeft size={16} />
              People
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Icon size={16} />
              {eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              {description}
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-2 sm:flex">
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/explore"
            >
              Connections
            </Link>
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/explore?tab=passed"
            >
              Passed
            </Link>
            <Link
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/messages"
            >
              <MessageCircle size={16} />
              Chats
            </Link>
            <Link
              className="relative flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/notifications"
            >
              <Bell size={16} />
              Notifications
              <NotificationBadge />
            </Link>
          </nav>
        </header>

        {profiles.length === 0 ? (
          <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[#607265]">
              {accentLabel}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{emptyTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
              {emptyBody}
            </p>
            <Link
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
              href="/"
            >
              Open People
            </Link>
          </section>
        ) : (
          <ProfileCollectionGrid
            accentLabel={accentLabel}
            allowMessaging={allowMessaging}
            profiles={profiles}
            restorePassed={restorePassed}
          />
        )}
      </div>
    </main>
  );
}
