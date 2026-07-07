import {
  Bell,
  CreditCard,
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
  getProfileQuality,
  getProfileVerification,
} from "@/lib/profile/service";
import { getPremiumStatus } from "@/lib/premium/service";
import { AccountActions } from "../settings/account-actions";

const meActions = [
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
  },
  {
    body: "Review Tribe Plus, boosts, usage counters, restore purchases, and subscription status.",
    href: "/premium",
    icon: CreditCard,
    label: "Premium",
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
  },
] as const;

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
            <MeActionCard action={action} key={action.label} />
          ))}
        </section>

        <AccountActions />
      </div>
    </main>
  );
}

function MeActionCard({
  action,
}: {
  action: {
    body: string;
    href: string;
    icon: LucideIcon;
    label: string;
  };
}) {
  const Icon = action.icon;

  return (
    <Link
      className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm transition hover:border-[#9dad9f] hover:bg-[#fbfaf4]"
      href={action.href}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
        <Icon size={16} />
        {action.label}
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
