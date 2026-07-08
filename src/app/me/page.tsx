import {
  Bell,
  CreditCard,
  MessageSquareText,
  Mic,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { VerificationBadges } from "@/components/profile/verification-badges";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  getFeatureFlags,
  type FeatureFlagKey,
  type FeatureFlagState,
} from "@/lib/feature-flags";
import {
  getProfileQuality,
  getProfileVerification,
} from "@/lib/profile/service";
import { getPremiumStatus } from "@/lib/premium/service";
import { AccountActions } from "../settings/account-actions";

type MeAction = {
  body: string;
  feature?: FeatureFlagKey;
  href: string;
  icon: LucideIcon;
  label: string;
};

const meActions: MeAction[] = [
  {
    body: "Update your photos, prompts, voice intro, visibility, and profile basics.",
    href: "/profile/edit",
    icon: UserRound,
    label: "Profile",
  },
  {
    body: "Use optional coaching for bios, prompts, match explanations, and conversation starters.",
    href: "/ai",
    icon: Sparkles,
    label: "AI Coach",
    feature: "ai",
  },
  {
    body: "Review Tribe Plus, boosts, usage counters, restore purchases, and subscription status.",
    href: "/premium",
    icon: CreditCard,
    label: "Premium",
    feature: "premium",
  },
  {
    body: "Record or update the voice intro people hear on your profile.",
    href: "/profile/edit",
    icon: Mic,
    label: "Voice Intro",
  },
  {
    body: "Manage account, privacy, discovery, notification, messaging, and subscription settings.",
    href: "/settings",
    icon: UserRound,
    label: "Settings",
  },
  {
    body: "Review reports, blocked users, hidden users, privacy controls, and deletion requests.",
    href: "/safety",
    icon: ShieldCheck,
    label: "Safety Center",
  },
  {
    body: "Share bugs, confusing moments, safety concerns, and ideas with the private beta team.",
    href: "/feedback",
    icon: MessageSquareText,
    label: "Beta Feedback",
  },
  {
    body: "Review activity updates and mark notifications as read.",
    href: "/notifications",
    icon: Bell,
    label: "Notifications",
  },
  {
    body: "Manage purchase status, active boosts, and restore purchases.",
    href: "/premium/manage",
    icon: CreditCard,
    label: "Subscription",
    feature: "premium",
  },
];

export default async function MePage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const [quality, premiumStatus] = await Promise.all([
    getProfileQuality(session.ownedProfile),
    getPremiumStatus(session.ownedProfile),
  ]);
  const { profile } = session.ownedProfile;
  const displayName = profile.display_name || "Your profile";
  const featureFlags = getFeatureFlags();

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[#d8ded1] pb-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
            <UserRound size={16} />
            Me
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{displayName}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
                Manage the profile, trust controls, settings, and optional tools
                that shape how TribeApp works for you.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <VerificationBadges
                  verification={getProfileVerification(profile)}
                />
                {premiumStatus.isPremium ? (
                  <PremiumBadge label={premiumStatus.premiumBadgeLabel} />
                ) : null}
                {premiumStatus.hasActiveBoost ? <PremiumBadge boost /> : null}
              </div>
            </div>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
              href="/profile/edit"
            >
              Edit profile
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-3 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm sm:grid-cols-3">
          <StatusTile label="Profile quality" value={`${quality.completeness}%`} />
          <StatusTile label="Visibility" value={profile.visibility} />
          <StatusTile
            label="Discoverable"
            value={profile.discoverable ? "On" : "Off"}
          />
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {meActions.map((action) => (
            <MeActionCard
              action={action}
              feature={
                action.feature ? featureFlags[action.feature] : undefined
              }
              key={action.label}
            />
          ))}
        </section>

        <AccountActions />
      </div>
    </main>
  );
}

function MeActionCard({
  action,
  feature,
}: {
  action: {
    body: string;
    feature?: FeatureFlagKey;
    href: string;
    icon: LucideIcon;
    label: string;
  };
  feature?: FeatureFlagState;
}) {
  const Icon = action.icon;
  const comingSoon = feature ? !feature.enabled : false;

  return (
    <Link
      className={`rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm transition hover:border-[#9dad9f] hover:bg-[#fbfaf4] ${
        comingSoon ? "opacity-75" : ""
      }`}
      href={action.href}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
        <Icon size={16} />
        {action.label}
        {comingSoon ? (
          <span className="ml-auto rounded-md bg-[#e1f0e9] px-2 py-1 text-[11px] font-bold uppercase text-[#23624f]">
            Coming Soon
          </span>
        ) : null}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#34443a]">{action.body}</p>
    </Link>
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
