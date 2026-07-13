import {
  ArrowLeft,
  Crown,
  Heart,
  History,
  Lock,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileCollectionGrid } from "@/components/discovery/profile-collection-grid";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { RealtimePageRefresh } from "@/components/realtime/realtime-page-refresh";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  getInboundLikedDiscoveryProfiles,
  getInboundLikedProfileCount,
  getLikedDiscoveryProfiles,
  getMutualLikedDiscoveryProfiles,
  getPassedDiscoveryProfiles,
  type DiscoveryCollectionProfile,
} from "@/lib/discovery/service";
import { getFeatureFlag } from "@/lib/feature-flags";
import { getPremiumStatus } from "@/lib/premium/service";

const tabs = [
  {
    body: "Profiles you liked from discovery.",
    href: "/explore?tab=liked",
    icon: Heart,
    key: "liked",
    label: "People I liked",
  },
  {
    body: "Profiles hidden from your active queue.",
    href: "/explore?tab=passed",
    icon: History,
    key: "passed",
    label: "People I passed",
  },
  {
    body: "Premium view of inbound interest.",
    href: "/explore?tab=liked-me",
    icon: Crown,
    key: "liked-me",
    label: "Who liked me",
  },
  {
    body: "Mutual likes that can open messaging.",
    href: "/explore?tab=matches",
    icon: Users,
    key: "matches",
    label: "Matches",
  },
] as const;

type ExploreTab = (typeof tabs)[number]["key"];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const activeTab = parseTab(params.tab);
  const [likedProfiles, passedProfiles, matches, premiumStatus] =
    await Promise.all([
      getLikedDiscoveryProfiles(session.ownedProfile),
      getPassedDiscoveryProfiles(session.ownedProfile),
      getMutualLikedDiscoveryProfiles(session.ownedProfile),
      getPremiumStatus(session.ownedProfile),
    ]);
  const premiumFeature = getFeatureFlag("premium");
  const premiumAvailable = premiumFeature.enabled;

  if (
    !likedProfiles.completed ||
    !passedProfiles.completed ||
    !matches.completed
  ) {
    redirect("/onboarding");
  }

  const canSeeWhoLikedMe =
    premiumAvailable && premiumStatus.featureGates.seeWhoLikedYou;
  const inboundProfiles = canSeeWhoLikedMe
    ? await getInboundLikedDiscoveryProfiles(session.ownedProfile)
    : null;
  const inboundCount = inboundProfiles
    ? inboundProfiles.profiles.length
    : await getInboundLikedProfileCount(session.ownedProfile);

  if (inboundProfiles && !inboundProfiles.completed) {
    redirect("/onboarding");
  }

  const activeProfiles = getActiveProfiles({
    activeTab,
    inboundProfiles: inboundProfiles?.profiles ?? [],
    likedProfiles: likedProfiles.profiles,
    matches: matches.profiles,
    passedProfiles: passedProfiles.profiles,
  });

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <RealtimePageRefresh events={["connections"]} />
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
              <Sparkles size={16} />
              Connections
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Likes, passes, and matches
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              Review people you liked, restore passed profiles, see mutual
              likes, and use Premium to reveal who liked you.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {premiumStatus.isPremium ? (
              <span className="flex h-10 items-center justify-center">
                <PremiumBadge label="Tribe Plus" />
              </span>
            ) : (
              <Link
                className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
                href="/premium"
              >
                <Crown size={16} />
                {premiumAvailable ? "Upgrade" : "Coming Soon"}
              </Link>
            )}
            <Link
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/messages"
            >
              <MessageCircle size={16} />
              Chats
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-3 md:grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const count = getTabCount({
              inboundCount,
              likedProfiles: likedProfiles.profiles,
              matches: matches.profiles,
              passedProfiles: passedProfiles.profiles,
              tab: tab.key,
            });

            return (
              <Link
                className={[
                  "rounded-lg border p-4 shadow-sm transition",
                  activeTab === tab.key
                    ? "border-[#17251f] bg-white"
                    : "border-[#d8ded1] bg-white hover:border-[#9dad9f] hover:bg-[#fbfaf4]",
                ].join(" ")}
                href={tab.href}
                key={tab.key}
              >
                <p className="flex items-center justify-between gap-2 text-sm font-semibold text-[#607265]">
                  <span className="flex items-center gap-2">
                    <Icon size={16} />
                    {tab.label}
                  </span>
                  <span className="rounded-md bg-[#f7f4e9] px-2 py-1 text-xs font-bold text-[#17201b]">
                    {count}
                  </span>
                </p>
                <p className="mt-2 text-sm leading-5 text-[#34443a]">
                  {tab.body}
                </p>
              </Link>
            );
          })}
        </section>

        {activeTab === "liked-me" && !canSeeWhoLikedMe ? (
          <LockedWhoLikedMe
            inboundCount={inboundCount}
            premiumAvailable={premiumAvailable}
          />
        ) : activeProfiles.length === 0 ? (
          <ExploreEmptyState activeTab={activeTab} />
        ) : (
          <ProfileCollectionGrid
            accentLabel={getAccentLabel(activeTab)}
            allowMessaging={activeTab === "liked" || activeTab === "matches"}
            profiles={activeProfiles}
            restorePassed={activeTab === "passed"}
          />
        )}
      </div>
    </main>
  );
}

function parseTab(tab?: string): ExploreTab {
  return tabs.some((item) => item.key === tab) ? (tab as ExploreTab) : "liked";
}

function getActiveProfiles({
  activeTab,
  inboundProfiles,
  likedProfiles,
  matches,
  passedProfiles,
}: {
  activeTab: ExploreTab;
  inboundProfiles: DiscoveryCollectionProfile[];
  likedProfiles: DiscoveryCollectionProfile[];
  matches: DiscoveryCollectionProfile[];
  passedProfiles: DiscoveryCollectionProfile[];
}) {
  if (activeTab === "passed") {
    return passedProfiles;
  }

  if (activeTab === "liked-me") {
    return inboundProfiles;
  }

  if (activeTab === "matches") {
    return matches;
  }

  return likedProfiles;
}

function getTabCount({
  inboundCount,
  likedProfiles,
  matches,
  passedProfiles,
  tab,
}: {
  inboundCount: number;
  likedProfiles: DiscoveryCollectionProfile[];
  matches: DiscoveryCollectionProfile[];
  passedProfiles: DiscoveryCollectionProfile[];
  tab: ExploreTab;
}) {
  if (tab === "passed") {
    return passedProfiles.length;
  }

  if (tab === "liked-me") {
    return inboundCount;
  }

  if (tab === "matches") {
    return matches.length;
  }

  return likedProfiles.length;
}

function getAccentLabel(tab: ExploreTab) {
  if (tab === "passed") {
    return "Passed";
  }

  if (tab === "liked-me") {
    return "Liked you";
  }

  if (tab === "matches") {
    return "Matched";
  }

  return "Liked";
}

function ExploreEmptyState({ activeTab }: { activeTab: ExploreTab }) {
  const copy = {
    liked: {
      body: "Like profiles that feel aligned. They will appear here so you can revisit them.",
      title: "No liked profiles yet.",
    },
    passed: {
      body: "Passed profiles stay out of active discovery until you restore them.",
      title: "No passed profiles yet.",
    },
    "liked-me": {
      body: "When other members like your profile, Premium members can review them here.",
      title: "No one has liked your profile yet.",
    },
    matches: {
      body: "Matches appear after both people like each other. Messaging stays permission-based.",
      title: "No mutual likes yet.",
    },
  }[activeTab];

  return (
    <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#607265]">Connections</p>
      <h2 className="mt-1 text-xl font-semibold">{copy.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
        {copy.body}
      </p>
      <Link
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
        href="/"
      >
        Open People
      </Link>
    </section>
  );
}

function LockedWhoLikedMe({
  inboundCount,
  premiumAvailable,
}: {
  inboundCount: number;
  premiumAvailable: boolean;
}) {
  return (
    <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
        <Lock size={16} />
        Premium
      </p>
      <h2 className="mt-1 text-xl font-semibold">See who liked you</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
        {inboundCount > 0
          ? `${inboundCount} ${
              inboundCount === 1 ? "person has" : "people have"
            } liked your profile.`
          : "Inbound likes will appear here when members show interest."}{" "}
        {premiumAvailable
          ? "Upgrade to Tribe Plus to view profiles, compare compatibility, and decide who to like back."
          : "This feature will be available when Tribe Plus launches."}
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
          href="/premium"
        >
          <Crown size={16} />
          {premiumAvailable ? "Upgrade to Premium" : "Coming Soon"}
        </Link>
        <Link
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
          href="/explore?tab=matches"
        >
          View matches
        </Link>
      </div>
    </section>
  );
}
