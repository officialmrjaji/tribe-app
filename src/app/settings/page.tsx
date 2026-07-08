import {
  ArrowLeft,
  Bell,
  CreditCard,
  Eye,
  Lock,
  MessageCircle,
  Mic,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  getFeatureFlags,
  type FeatureFlagKey,
  type FeatureFlagState,
} from "@/lib/feature-flags";
import { AccountActions } from "./account-actions";

type SettingsSection = {
  body: string;
  feature?: FeatureFlagKey;
  href: string;
  icon: LucideIcon;
  label: string;
};

const settingsSections: SettingsSection[] = [
  {
    body: "Name, email, sign-in methods, and profile ownership are managed through your Tribe account.",
    href: "/profile/edit",
    icon: UserRound,
    label: "Account",
  },
  {
    body: "Control profile visibility, discoverability, and what other members can see from your profile.",
    href: "/profile/edit",
    icon: Lock,
    label: "Privacy",
  },
  {
    body: "Tune whether you appear in recommendations and keep your profile quality above launch standards.",
    href: "/profile/edit",
    icon: Search,
    label: "People visibility",
  },
  {
    body: "Review in-app notifications for likes, matches, conversations, and messages.",
    href: "/notifications",
    icon: Bell,
    label: "Notifications",
  },
  {
    body: "Messaging stays permission-based: conversations open after mutual likes and respect blocks.",
    href: "/messages",
    icon: MessageCircle,
    label: "Messaging",
  },
  {
    body: "Start random 2-minute voice matches, continue when both people agree, create rooms, and manage voice-first profile signals.",
    href: "/voice",
    icon: Mic,
    label: "Voice Rooms",
  },
  {
    body: "Manage blocked users, reports, hidden users, privacy controls, and delete-account confirmation.",
    href: "/safety",
    icon: ShieldCheck,
    label: "Safety",
  },
  {
    body: "Use optional profile, match, conversation, and safety drafting support without auto-sending anything.",
    href: "/ai",
    icon: Sparkles,
    label: "AI Companion",
    feature: "ai",
  },
  {
    body: "Review Tribe Plus, boosts, usage counters, restore purchases, and subscription status.",
    href: "/premium/manage",
    icon: CreditCard,
    label: "Subscription",
    feature: "premium",
  },
];

export default async function SettingsPage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const { profile } = session.ownedProfile;
  const featureFlags = getFeatureFlags();

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
              People
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Eye size={16} />
              Settings
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Account and app controls
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              Review the controls that shape your privacy, discovery access,
              messaging permissions, safety posture, and future subscription.
            </p>
          </div>
          <Link
            className="flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
            href="/profile/edit"
          >
            Edit profile
          </Link>
        </header>

        <section className="mt-6 grid gap-3 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm sm:grid-cols-3">
          <StatusTile label="Visibility" value={profile.visibility} />
          <StatusTile
            label="Discoverable"
            value={profile.discoverable ? "On" : "Off"}
          />
          <StatusTile
            label="Profile quality"
            value={`${profile.profile_completion_score}%`}
          />
        </section>

        <AccountActions />

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            const feature = section.feature
              ? featureFlags[section.feature]
              : undefined;
            const comingSoon = feature ? !feature.enabled : false;

            return (
              <Link
                className={`rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm transition hover:border-[#9dad9f] hover:bg-[#fbfaf4] ${
                  comingSoon ? "opacity-75" : ""
                }`}
                href={section.href}
                key={section.label}
              >
                <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
                  <Icon size={16} />
                  {section.label}
                  {comingSoon ? <FeatureBadge feature={feature} /> : null}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#34443a]">
                  {section.body}
                </p>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function FeatureBadge({ feature }: { feature?: FeatureFlagState }) {
  return (
    <span className="ml-auto rounded-md bg-[#e1f0e9] px-2 py-1 text-[11px] font-bold uppercase text-[#23624f]">
      {feature?.badgeLabel ?? "Coming Soon"}
    </span>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3">
      <p className="text-xs font-semibold uppercase text-[#607265]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#17201b]">{value}</p>
    </div>
  );
}
