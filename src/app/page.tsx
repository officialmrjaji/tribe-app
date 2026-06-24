"use client";

import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  Coffee,
  Compass,
  Heart,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Music,
  Palette,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRound,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DiscoveryProfile } from "@/lib/discovery/service";

const focusModes = ["Deep talk", "Soft plans", "New circle"] as const;
type FocusMode = (typeof focusModes)[number];

const filterOptions = ["All", "Creative", "Grounded", "Curious", "Local"] as const;
type FilterOption = (typeof filterOptions)[number];

const axisMetrics = [
  { label: "Depth", key: "depth", icon: BookOpen },
  { label: "Energy", key: "energy", icon: Zap },
  { label: "Curiosity", key: "curiosity", icon: Star },
] as const;

const circleIcons = [Palette, Coffee, Music] as const;

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function Home() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<"checking" | "ready" | "error">(
    "checking",
  );
  const [accessError, setAccessError] = useState("");
  const [actionError, setActionError] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");
  const [activeFocus, setActiveFocus] = useState<FocusMode>("Deep talk");
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingActionProfileId, setPendingActionProfileId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDiscovery() {
      try {
        const response = await fetch("/api/discover", {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (response.redirected) {
          window.location.assign(response.url);
          return;
        }

        const payload = await response.json().catch(() => null);

        if (response.status === 409 && payload?.redirectTo) {
          router.replace(payload.redirectTo);
          return;
        }

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load discovery.");
        }

        if (isMounted) {
          const nextProfiles = (payload?.profiles ?? []) as DiscoveryProfile[];
          setProfiles(nextProfiles);
          setSavedIds(payload?.savedProfileIds ?? []);
          setSelectedId(nextProfiles[0]?.id ?? null);
          setAccessState("ready");
        }
      } catch (error) {
        if (isMounted) {
          setAccessError(
            error instanceof Error ? error.message : "Unable to load discovery.",
          );
          setAccessState("error");
        }
      }
    }

    loadDiscovery();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const visibleProfiles = useMemo(() => {
    if (activeFilter === "All") {
      return profiles;
    }

    return profiles.filter((profile) => profile.traits.includes(activeFilter));
  }, [activeFilter, profiles]);

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedId) ??
    visibleProfiles[0] ??
    profiles[0] ??
    null;

  const promptIndex = focusModes.indexOf(activeFocus);

  async function saveProfile(profileId: string) {
    if (savedIds.includes(profileId)) {
      return;
    }

    setPendingActionProfileId(profileId);
    setActionError("");

    try {
      const response = await fetch("/api/profile/save", {
        body: JSON.stringify({ profileId }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Profile could not be saved.");
      }

      setSavedIds((currentIds) =>
        currentIds.includes(profileId) ? currentIds : [...currentIds, profileId],
      );
      setProfiles((currentProfiles) =>
        currentProfiles.map((profile) =>
          profile.id === profileId ? { ...profile, isSaved: true } : profile,
        ),
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Profile could not be saved.",
      );
    } finally {
      setPendingActionProfileId(null);
    }
  }

  async function passProfile(profileId: string) {
    setPendingActionProfileId(profileId);
    setActionError("");

    try {
      const response = await fetch("/api/profile/pass", {
        body: JSON.stringify({ profileId }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Profile could not be passed.");
      }

      const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
      setProfiles(nextProfiles);
      setSavedIds((currentIds) => currentIds.filter((id) => id !== profileId));

      if (selectedId === profileId) {
        setSelectedId(nextProfiles[0]?.id ?? null);
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Profile could not be passed.",
      );
    } finally {
      setPendingActionProfileId(null);
    }
  }

  if (accessState === "checking") {
    return <DiscoveryAccessState />;
  }

  if (accessState === "error") {
    return <DiscoveryAccessState error={accessError} />;
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] text-[#17201b]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[236px_minmax(0,1fr)_340px]">
        <aside className="border-b border-[#d8ded1] bg-[#17251f] px-4 py-4 text-[#f7f4e9] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between lg:block">
            <div>
              <p className="text-xs font-medium uppercase text-[#acc7bc]">
                Tribe
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Discovery</h1>
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[#385046] text-[#f7f4e9] transition hover:bg-[#22362e] lg:hidden"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
          </div>

          <nav className="mt-5 grid grid-cols-4 gap-2 lg:grid-cols-1">
            {[
              { label: "Discover", icon: Compass, active: true },
              { label: "Circles", icon: Users, active: false },
              { label: "Inbox", icon: MessageCircle, active: false },
              { label: "Rituals", icon: CalendarDays, active: false },
            ].map((item) => (
              <NavButton key={item.label} item={item} />
            ))}
          </nav>

          <div className="mt-6 hidden border-t border-[#385046] pt-5 lg:block">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal size={17} />
              Signal Mix
            </div>
            <div className="mt-4 space-y-4">
              {[
                ["Conversation depth", 88],
                ["Plan reliability", 74],
                ["Social overlap", 67],
              ].map(([label, value]) => (
                <label key={label} className="block text-sm text-[#dce7e2]">
                  <span className="flex items-center justify-between">
                    <span>{label}</span>
                    <span>{value}%</span>
                  </span>
                  <input
                    className="mt-2 h-2 w-full accent-[#f6c66f]"
                    defaultValue={value}
                    max="100"
                    min="0"
                    type="range"
                  />
                </label>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-medium text-[#607265]">
                Personality-first matches
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[#17201b]">
                Find people by pace, values, and social texture.
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm shadow-sm sm:w-72">
                <Search size={17} className="shrink-0 text-[#607265]" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-[#17201b] outline-none placeholder:text-[#7c8b80]"
                  placeholder="Search values, circles, plans"
                  type="search"
                />
              </label>
              <Link
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
                href="/profile/edit"
              >
                <UserRound size={17} />
                Edit Profile
              </Link>
            </div>
          </header>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {filterOptions.map((option) => (
                <button
                  key={option}
                  className={cx(
                    "h-10 rounded-md border px-4 text-sm font-semibold transition",
                    activeFilter === option
                      ? "border-[#17251f] bg-[#17251f] text-white"
                      : "border-[#cbd4c6] bg-white text-[#34443a] hover:border-[#8fa298]",
                  )}
                  onClick={() => setActiveFilter(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 rounded-md border border-[#cbd4c6] bg-white p-1">
              {focusModes.map((mode) => (
                <button
                  key={mode}
                  className={cx(
                    "h-9 rounded-md px-3 text-sm font-semibold transition",
                    activeFocus === mode
                      ? "bg-[#f6c66f] text-[#17201b]"
                      : "text-[#607265] hover:bg-[#f3f0e6]",
                  )}
                  onClick={() => setActiveFocus(mode)}
                  type="button"
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {actionError ? (
            <p className="mt-4 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]">
              {actionError}
            </p>
          ) : null}

          {profiles.length === 0 ? (
            <EmptyDiscovery />
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleProfiles.length === 0 ? (
                <div className="rounded-lg border border-[#d8ded1] bg-white p-5 text-sm leading-6 text-[#34443a] shadow-sm md:col-span-2 xl:col-span-3">
                  No recommendations match this filter yet.
                </div>
              ) : null}

              {visibleProfiles.map((profile) => {
                const isSelected = profile.id === selectedProfile?.id;
                const isSaved = savedIds.includes(profile.id) || profile.isSaved;
                const isPending = pendingActionProfileId === profile.id;

                return (
                  <article
                    key={profile.id}
                    className={cx(
                      "rounded-lg border bg-white p-4 shadow-sm transition",
                      isSelected
                        ? "border-[#17251f] shadow-md"
                        : "border-[#d8ded1] hover:border-[#9dad9f]",
                    )}
                  >
                    <button
                      className="block w-full text-left"
                      onClick={() => setSelectedId(profile.id)}
                      type="button"
                    >
                      <div className="flex items-start gap-3">
                        <Image
                          alt={`${profile.name} avatar`}
                          className="h-16 w-16 shrink-0 rounded-md object-cover"
                          height={64}
                          src={profile.image}
                          width={64}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-lg font-semibold">
                                {profile.name}
                                {profile.age ? `, ${profile.age}` : ""}
                              </h3>
                              <p className="mt-1 flex items-center gap-1 text-sm text-[#607265]">
                                <MapPin size={14} />
                                {profile.city}
                              </p>
                            </div>
                            <span
                              className={cx(
                                "flex h-10 w-12 shrink-0 items-center justify-center rounded-md text-sm font-bold text-[#17201b]",
                                profile.accent,
                              )}
                            >
                              {profile.match}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-[#34443a]">
                            {profile.archetype}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 min-h-12 text-sm leading-6 text-[#4e5e54]">
                        {profile.signal}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {profile.traits.map((trait) => (
                          <span
                            key={trait}
                            className="rounded-md border border-[#d8ded1] bg-[#f6f7f1] px-2.5 py-1 text-xs font-semibold text-[#34443a]"
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    </button>

                    <div className="mt-4 flex items-center gap-2 border-t border-[#e2e6dc] pt-3">
                      <button
                        className={cx(
                          "flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-semibold transition disabled:opacity-60",
                          isSaved
                            ? "bg-[#ef8f7a] text-[#17201b]"
                            : "bg-[#edf2e9] text-[#34443a] hover:bg-[#e2eadc]",
                        )}
                        disabled={isPending || isSaved}
                        onClick={() => saveProfile(profile.id)}
                        type="button"
                      >
                        {isPending ? (
                          <LoaderCircle className="animate-spin" size={16} />
                        ) : isSaved ? (
                          <Check size={16} />
                        ) : (
                          <Heart size={16} />
                        )}
                        {isSaved ? "Saved" : "Save"}
                      </button>
                      <button
                        className="flex h-10 w-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white text-[#34443a] transition hover:bg-[#f3f0e6] disabled:opacity-60"
                        disabled={isPending}
                        onClick={() => passProfile(profile.id)}
                        type="button"
                        aria-label={`Pass ${profile.name}`}
                      >
                        {isPending ? (
                          <LoaderCircle className="animate-spin" size={18} />
                        ) : (
                          <X size={18} />
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="border-t border-[#d8ded1] bg-white px-4 py-5 sm:px-6 lg:border-l lg:border-t-0">
          {selectedProfile ? (
            <SelectedProfilePanel
              activeFocus={activeFocus}
              isPending={pendingActionProfileId === selectedProfile.id}
              isSaved={
                savedIds.includes(selectedProfile.id) || selectedProfile.isSaved
              }
              onPass={() => passProfile(selectedProfile.id)}
              onSave={() => saveProfile(selectedProfile.id)}
              profile={selectedProfile}
              promptIndex={promptIndex}
            />
          ) : (
            <div className="rounded-lg border border-[#d8ded1] bg-[#fbfaf4] p-4 text-sm leading-6 text-[#34443a] shadow-sm">
              Complete onboarding and make sure other members have discoverable
              profiles to see recommendations here.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function SelectedProfilePanel({
  activeFocus,
  isPending,
  isSaved,
  onPass,
  onSave,
  profile,
  promptIndex,
}: {
  activeFocus: FocusMode;
  isPending: boolean;
  isSaved: boolean;
  onPass: () => void;
  onSave: () => void;
  profile: DiscoveryProfile;
  promptIndex: number;
}) {
  return (
    <div className="rounded-lg border border-[#d8ded1] bg-[#fbfaf4] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Image
          alt={`${profile.name} avatar`}
          className="h-20 w-20 rounded-md object-cover"
          height={80}
          src={profile.image}
          width={80}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#607265]">
            Selected signal
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {profile.name}
            {profile.age ? `, ${profile.age}` : ""}
          </h2>
          <p className="mt-1 text-sm text-[#607265]">{profile.temperament}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[#34443a]">{profile.bio}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-[#e2e6dc] py-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#607265]">
            <Sparkles size={14} />
            Pace
          </p>
          <p className="mt-1 text-sm font-semibold">{profile.pace}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#607265]">
            <CalendarDays size={14} />
            Open
          </p>
          <p className="mt-1 text-sm font-semibold">{profile.availability}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {axisMetrics.map((metric) => {
          const Icon = metric.icon;
          const value = profile.axes[metric.key];

          return (
            <div key={metric.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <Icon size={15} />
                  {metric.label}
                </span>
                <span>{value}%</span>
              </div>
              <div className="mt-2 h-2 rounded-md bg-[#e2e6dc]">
                <div
                  className="h-2 rounded-md bg-[#17251f]"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-[#607265]">
          Values in common
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {profile.values.map((value) => (
            <span
              key={value}
              className="rounded-md bg-[#17251f] px-2.5 py-1 text-xs font-semibold text-white"
            >
              {value}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-[#607265]">Circle overlap</p>
        <div className="mt-3 space-y-2">
          {profile.circles.map((circle, index) => {
            const Icon = circleIcons[index] ?? Users;

            return (
              <div
                key={circle}
                className="flex min-h-10 items-center justify-between border-b border-[#e2e6dc] pb-2 text-sm last:border-b-0 last:pb-0"
              >
                <span className="flex items-center gap-2">
                  <Icon size={16} />
                  {circle}
                </span>
                <ShieldCheck size={16} className="text-[#587d62]" />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-[#607265]">
          Prompt for {activeFocus.toLowerCase()}
        </p>
        <div className="mt-2 rounded-md border border-[#d8ded1] bg-white p-3">
          <p className="text-sm leading-6 text-[#34443a]">
            {profile.prompts[promptIndex] ?? profile.prompts[0]}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_44px] gap-2">
        <button
          className={cx(
            "flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:opacity-60",
            isSaved
              ? "bg-[#ef8f7a] text-[#17201b]"
              : "bg-[#17251f] text-white hover:bg-[#253b32]",
          )}
          disabled={isPending || isSaved}
          onClick={onSave}
          type="button"
        >
          {isPending ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : isSaved ? (
            <Check size={17} />
          ) : (
            <Heart size={17} />
          )}
          {isSaved ? "Saved" : "Save Profile"}
        </button>
        <button
          className="flex h-11 items-center justify-center rounded-md bg-[#f6c66f] text-[#17201b] transition hover:bg-[#edb654] disabled:opacity-60"
          disabled={isPending}
          onClick={onPass}
          type="button"
          aria-label={`Pass ${profile.name}`}
        >
          {isPending ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : (
            <X size={17} />
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyDiscovery() {
  return (
    <section className="mt-5 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#607265]">
        No recommendations yet
      </p>
      <h3 className="mt-1 text-xl font-semibold">
        Discovery will fill in as members complete profiles.
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
        The mock profiles are gone. Tribe is now reading from Supabase and will
        hide your own profile, passed profiles, and blocked profiles from this
        view.
      </p>
    </section>
  );
}

function DiscoveryAccessState({ error }: { error?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f1] px-4 text-[#17201b]">
      <section className="w-full max-w-md rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#17251f] text-white">
            <LoaderCircle className={error ? "" : "animate-spin"} size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#607265]">
              {error ? "Discovery is paused" : "Checking recommendations"}
            </p>
            <h1 className="mt-1 text-xl font-semibold">
              {error ? "Discovery needs attention" : "Preparing Tribe"}
            </h1>
          </div>
        </div>
        {error ? (
          <>
            <p className="mt-4 text-sm leading-6 text-[#34443a]">{error}</p>
            <button
              className="mt-5 flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
              onClick={() => window.location.reload()}
              type="button"
            >
              Try again
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

function NavButton({
  item,
}: {
  item: {
    active: boolean;
    icon: LucideIcon;
    label: string;
  };
}) {
  const Icon = item.icon;

  return (
    <button
      className={cx(
        "flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition lg:justify-start",
        item.active
          ? "bg-[#f7f4e9] text-[#17251f]"
          : "text-[#cddbd4] hover:bg-[#22362e]",
      )}
      type="button"
    >
      <Icon size={17} />
      <span className="hidden sm:inline">{item.label}</span>
    </button>
  );
}
