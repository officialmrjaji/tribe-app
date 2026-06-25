"use client";

import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  Coffee,
  Compass,
  Heart,
  History,
  LoaderCircle,
  MapPin,
  Music,
  Palette,
  RefreshCcw,
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
const undoPassActionId = "__undo_last_pass__";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type ApiErrorPayload = {
  error?: string;
  issues?: Array<{
    message?: string;
  }>;
};

function getActionFailureMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const actionPayload = payload as ApiErrorPayload;
  const firstIssue = actionPayload.issues?.[0]?.message;

  return [actionPayload.error, firstIssue].filter(Boolean).join(" ") || fallback;
}

export default function Home() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<"checking" | "ready" | "error">(
    "checking",
  );
  const [accessError, setAccessError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");
  const [activeFocus, setActiveFocus] = useState<FocusMode>("Deep talk");
  const [lastPassedProfile, setLastPassedProfile] =
    useState<DiscoveryProfile | null>(null);
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
  const isUndoingLastPass = pendingActionProfileId === undoPassActionId;

  async function saveProfile(profileId: string) {
    if (savedIds.includes(profileId)) {
      return;
    }

    setPendingActionProfileId(profileId);
    setActionError("");
    setActionMessage("");

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
        throw new Error(
          getActionFailureMessage(payload, "Profile could not be saved."),
        );
      }

      const savedProfile = profiles.find((profile) => profile.id === profileId);

      setSavedIds((currentIds) =>
        currentIds.includes(profileId) ? currentIds : [...currentIds, profileId],
      );
      setProfiles((currentProfiles) =>
        currentProfiles.map((profile) =>
          profile.id === profileId ? { ...profile, isSaved: true } : profile,
        ),
      );
      setActionMessage(
        `${savedProfile?.name ?? "Profile"} was added to saved profiles.`,
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
    setActionMessage("");

    try {
      const passedProfile = profiles.find((profile) => profile.id === profileId);
      const response = await fetch("/api/profile/pass", {
        body: JSON.stringify({ profileId }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getActionFailureMessage(payload, "Profile could not be passed."),
        );
      }

      const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
      setProfiles(nextProfiles);
      setSavedIds((currentIds) => currentIds.filter((id) => id !== profileId));
      setLastPassedProfile(passedProfile ?? null);
      setActionMessage(
        `${passedProfile?.name ?? "Profile"} was moved to passed profiles.`,
      );

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

  async function undoLastPass() {
    if (!lastPassedProfile) {
      return;
    }

    setPendingActionProfileId(undoPassActionId);
    setActionError("");
    setActionMessage("");

    try {
      const response = await fetch("/api/profile/pass/undo", {
        headers: {
          Accept: "application/json",
        },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getActionFailureMessage(payload, "Last pass could not be undone."),
        );
      }

      setProfiles((currentProfiles) =>
        currentProfiles.some((profile) => profile.id === lastPassedProfile.id)
          ? currentProfiles
          : [lastPassedProfile, ...currentProfiles],
      );
      setSelectedId(lastPassedProfile.id);
      setActionMessage(`${lastPassedProfile.name} is back in discovery.`);
      setLastPassedProfile(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Last pass could not be undone.",
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
              { label: "Discover", icon: Compass, href: "/", active: true },
              { label: "Saved", icon: Heart, href: "/saved", active: false },
              { label: "Passed", icon: History, href: "/passed", active: false },
              {
                label: "Profile",
                icon: UserRound,
                href: "/profile/edit",
                active: false,
              },
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
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
                href="/saved"
              >
                <Heart size={17} />
                Saved
              </Link>
              <Link
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
                href="/passed"
              >
                <History size={17} />
                Passed
              </Link>
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
            <ActionNotice message={actionError} tone="error" />
          ) : null}

          {!actionError && actionMessage ? (
            <ActionNotice message={actionMessage} tone="success" />
          ) : null}

          {lastPassedProfile ? (
            <div className="mt-4 flex flex-col gap-3 rounded-md border border-[#d8ded1] bg-white px-3 py-3 text-sm text-[#34443a] shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-semibold">{lastPassedProfile.name}</span>{" "}
                was passed.
              </p>
              <div className="flex gap-2">
                <button
                  className="flex h-9 items-center justify-center gap-2 rounded-md bg-[#17251f] px-3 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
                  disabled={isUndoingLastPass}
                  onClick={undoLastPass}
                  type="button"
                >
                  {isUndoingLastPass ? (
                    <LoaderCircle className="animate-spin" size={15} />
                  ) : (
                    <RefreshCcw size={15} />
                  )}
                  Undo pass
                </button>
                <Link
                  className="flex h-9 items-center justify-center rounded-md border border-[#cbd4c6] px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
                  href="/passed"
                >
                  Passed
                </Link>
              </div>
            </div>
          ) : null}

          {profiles.length === 0 ? (
            <EmptyDiscovery
              isUndoing={isUndoingLastPass}
              lastPassedProfile={lastPassedProfile}
              onUndoPass={undoLastPass}
            />
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleProfiles.length === 0 ? (
                <div className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm md:col-span-2 xl:col-span-3">
                  <p className="text-sm font-semibold text-[#607265]">
                    No matches for this filter
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#34443a]">
                    Try the full discovery queue, or check saved and passed
                    profiles while more people complete onboarding.
                  </p>
                  <button
                    className="mt-4 flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
                    onClick={() => setActiveFilter("All")}
                    type="button"
                  >
                    Show all matches
                  </button>
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

                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold uppercase text-[#607265]">
                          Why this match
                        </p>
                        {profile.reasons.slice(0, 2).map((reason) => (
                          <p
                            className="flex gap-2 rounded-md bg-[#fbfaf4] px-3 py-2 text-sm leading-5 text-[#34443a]"
                            key={reason}
                          >
                            <ShieldCheck
                              className="mt-0.5 shrink-0 text-[#587d62]"
                              size={15}
                            />
                            {reason}
                          </p>
                        ))}
                      </div>

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
        <p className="text-sm font-semibold text-[#607265]">Match reasons</p>
        <div className="mt-3 space-y-2">
          {profile.reasons.slice(0, 4).map((reason) => (
            <p
              className="flex gap-2 rounded-md border border-[#e2e6dc] bg-white px-3 py-2 text-sm leading-5 text-[#34443a]"
              key={reason}
            >
              <ShieldCheck className="mt-0.5 shrink-0 text-[#587d62]" size={15} />
              {reason}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-[#607265]">
          Conversation opener for {activeFocus.toLowerCase()}
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

function ActionNotice({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success";
}) {
  return (
    <p
      className={cx(
        "mt-4 rounded-md border bg-white px-3 py-2 text-sm font-semibold",
        tone === "error"
          ? "border-[#ef8f7a] text-[#8a3325]"
          : "border-[#94c973] text-[#2f5f36]",
      )}
    >
      {message}
    </p>
  );
}

function EmptyDiscovery({
  isUndoing,
  lastPassedProfile,
  onUndoPass,
}: {
  isUndoing: boolean;
  lastPassedProfile: DiscoveryProfile | null;
  onUndoPass: () => void;
}) {
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
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {lastPassedProfile ? (
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
            disabled={isUndoing}
            onClick={onUndoPass}
            type="button"
          >
            {isUndoing ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <RefreshCcw size={16} />
            )}
            Undo last pass
          </button>
        ) : null}
        <Link
          className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
          href="/passed"
        >
          View passed profiles
        </Link>
      </div>
    </section>
  );
}

function DiscoveryAccessState({ error }: { error?: string }) {
  if (!error) {
    return (
      <main className="min-h-screen bg-[#f6f7f1] text-[#17201b]">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[236px_minmax(0,1fr)_340px]">
          <aside className="border-b border-[#d8ded1] bg-[#17251f] px-4 py-4 text-[#f7f4e9] lg:border-b-0 lg:border-r">
            <div className="h-4 w-16 rounded-md bg-[#385046]" />
            <div className="mt-3 h-7 w-32 rounded-md bg-[#385046]" />
            <div className="mt-6 space-y-2">
              {[1, 2, 3, 4].map((item) => (
                <div className="h-11 rounded-md bg-[#22362e]" key={item} />
              ))}
            </div>
          </aside>

          <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
            <div className="border-b border-[#d8ded1] pb-5">
              <div className="h-4 w-44 rounded-md bg-[#d8ded1]" />
              <div className="mt-3 h-8 max-w-xl rounded-md bg-[#d8ded1]" />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm"
                  key={item}
                >
                  <div className="flex gap-3">
                    <div className="h-16 w-16 rounded-md bg-[#e2e6dc]" />
                    <div className="flex-1">
                      <div className="h-5 w-32 rounded-md bg-[#e2e6dc]" />
                      <div className="mt-3 h-4 w-24 rounded-md bg-[#e2e6dc]" />
                    </div>
                  </div>
                  <div className="mt-4 h-4 rounded-md bg-[#e2e6dc]" />
                  <div className="mt-2 h-4 w-4/5 rounded-md bg-[#e2e6dc]" />
                  <div className="mt-4 h-16 rounded-md bg-[#fbfaf4]" />
                </div>
              ))}
            </div>
          </section>

          <aside className="border-t border-[#d8ded1] bg-white px-4 py-5 sm:px-6 lg:border-l lg:border-t-0">
            <div className="h-20 rounded-md bg-[#e2e6dc]" />
            <div className="mt-4 h-24 rounded-md bg-[#fbfaf4]" />
            <div className="mt-4 h-40 rounded-md bg-[#fbfaf4]" />
          </aside>
        </div>
      </main>
    );
  }

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
      href: string;
      icon: LucideIcon;
      label: string;
    };
}) {
  const Icon = item.icon;

  return (
    <Link
      className={cx(
        "flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition lg:justify-start",
        item.active
          ? "bg-[#f7f4e9] text-[#17251f]"
          : "text-[#cddbd4] hover:bg-[#22362e]",
      )}
      href={item.href}
    >
      <Icon size={17} />
      <span className="hidden sm:inline">{item.label}</span>
    </Link>
  );
}
