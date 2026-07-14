"use client";

import {
  Check,
  Eye,
  Heart,
  LoaderCircle,
  MapPin,
  Mic,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SafeStorageImage } from "@/components/media/safe-storage-image";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { ProfilePhotoGallery } from "@/components/profile/profile-photo-gallery";
import { VerificationBadges } from "@/components/profile/verification-badges";
import type { DiscoveryProfile } from "@/lib/discovery/service";
import { genderOptions, type Gender } from "@/lib/onboarding/options";

const undoPassActionId = "__undo_last_pass__";
const advancedFilterLabels = [
  "Interests",
  "Personality",
  "Lifestyle",
  "Availability",
  "Location",
  "Goals",
] as const;

type DiscoveryFilters = {
  gender: Gender | "all";
  maxAge: string;
  minAge: string;
};

const defaultDiscoveryFilters: DiscoveryFilters = {
  gender: "all",
  maxAge: "",
  minAge: "",
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type ApiErrorPayload = {
  conversationId?: string | null;
  error?: string;
  issues?: Array<{
    message?: string;
  }>;
  matched?: boolean;
};

function getActionFailureMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const actionPayload = payload as ApiErrorPayload;
  const firstIssue = actionPayload.issues?.[0]?.message;

  return [actionPayload.error, firstIssue].filter(Boolean).join(" ") || fallback;
}

function getMatchLabel(score: number) {
  if (score >= 92) {
    return "Highly Compatible";
  }

  if (score >= 84) {
    return "Strong Match";
  }

  if (score >= 74) {
    return "Great Match";
  }

  return "Promising Match";
}

function loadSavedFilters(): DiscoveryFilters {
  if (typeof window === "undefined") {
    return defaultDiscoveryFilters;
  }

  try {
    const storedFilters = window.localStorage.getItem("tribe.people.filters");

    if (!storedFilters) {
      return defaultDiscoveryFilters;
    }

    return {
      ...defaultDiscoveryFilters,
      ...(JSON.parse(storedFilters) as Partial<DiscoveryFilters>),
    };
  } catch {
    return defaultDiscoveryFilters;
  }
}

function buildDiscoverUrl(filters: DiscoveryFilters) {
  const params = new URLSearchParams();

  if (filters.gender !== "all") {
    params.set("gender", filters.gender);
  }

  if (filters.minAge) {
    params.set("minAge", filters.minAge);
  }

  if (filters.maxAge) {
    params.set("maxAge", filters.maxAge);
  }

  const query = params.toString();

  return query ? `/api/discover?${query}` : "/api/discover";
}

export default function Home() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<"checking" | "ready" | "error">(
    "checking",
  );
  const [accessError, setAccessError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [appliedFilters, setAppliedFilters] =
    useState<DiscoveryFilters>(loadSavedFilters);
  const [filterDraft, setFilterDraft] =
    useState<DiscoveryFilters>(appliedFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
        setAccessState("checking");
        const response = await fetch(buildDiscoverUrl(appliedFilters), {
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
  }, [appliedFilters, router]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "tribe.people.filters",
        JSON.stringify(appliedFilters),
      );
    } catch {
      // Filters are still applied for this session.
    }
  }, [appliedFilters]);

  const visibleProfiles = useMemo(() => profiles, [profiles]);

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedId) ??
    visibleProfiles[0] ??
    profiles[0] ??
    null;

  const isUndoingLastPass = pendingActionProfileId === undoPassActionId;
  const activeFilterCount = [
    appliedFilters.gender !== "all",
    Boolean(appliedFilters.minAge),
    Boolean(appliedFilters.maxAge),
  ].filter(Boolean).length;

  function applyFilters() {
    setAppliedFilters(filterDraft);
    setFiltersOpen(false);
    setSelectedId(null);
  }

  function resetFilters() {
    setFilterDraft(defaultDiscoveryFilters);
    setAppliedFilters(defaultDiscoveryFilters);
    setFiltersOpen(false);
    setSelectedId(null);
  }

  async function saveProfile(profileId: string) {
    if (savedIds.includes(profileId)) {
      return;
    }

    setPendingActionProfileId(profileId);
    setActionError("");
    setActionMessage("");

    try {
      const response = await fetch("/api/profile/like", {
        body: JSON.stringify({ profileId }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getActionFailureMessage(payload, "Profile could not be liked."),
        );
      }

      const savedProfile = profiles.find((profile) => profile.id === profileId);

      setSavedIds((currentIds) =>
        currentIds.includes(profileId) ? currentIds : [...currentIds, profileId],
      );
      setProfiles((currentProfiles) =>
        currentProfiles.filter((profile) => profile.id !== profileId),
      );
      setSelectedId((currentId) =>
        currentId === profileId
          ? profiles.find((profile) => profile.id !== profileId)?.id ?? null
          : currentId,
      );
      setActionMessage(
        payload?.matched
          ? `You and ${savedProfile?.name ?? "this member"} liked each other. The chat is ready.`
          : `${savedProfile?.name ?? "Profile"} was liked and removed from this People queue.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Profile could not be liked.",
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
      setActionMessage(`${lastPassedProfile.name} is back in People.`);
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
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-medium text-[#607265]">
                Personality-first matches
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[#17201b]">
                People
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
                Find people by pace, values, and social texture.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                aria-expanded={filtersOpen}
                aria-label="Open People filters"
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
                onClick={() => setFiltersOpen((current) => !current)}
                type="button"
              >
                <SlidersHorizontal size={17} />
                Filters
                {activeFilterCount ? (
                  <span className="rounded-md bg-[#17251f] px-2 py-0.5 text-xs text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
              <Link
                aria-label="Open Voice Rooms"
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
                href="/voice"
              >
                <Mic size={17} />
                Voice
              </Link>
            </div>
          </header>

          {filtersOpen ? (
            <section className="mt-5">
              <PeopleFilterPanel
                draft={filterDraft}
                onApply={applyFilters}
                onChange={setFilterDraft}
                onReset={resetFilters}
              />
            </section>
          ) : null}

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
                  href="/explore?tab=passed"
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
                    Try the full People queue, or check liked and passed
                    profiles while more people complete onboarding.
                  </p>
                  <button
                    className="mt-4 flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
                    onClick={resetFilters}
                    type="button"
                  >
                    Reset filters
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
                    <div
                      className="block w-full cursor-pointer text-left"
                      aria-label={`View ${profile.name}'s profile details`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(profile.id);
                        }
                      }}
                      onClick={() => setSelectedId(profile.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start gap-3">
                        <ProfilePhotoGallery
                          label={`View ${profile.name}'s profile photos`}
                          photos={
                            profile.photos.length ? profile.photos : [profile.image]
                          }
                        >
                          <SafeStorageImage
                            alt={`${profile.name} avatar`}
                            className="h-20 w-20 shrink-0 rounded-md object-cover"
                            height={80}
                            src={profile.image}
                            width={80}
                          />
                        </ProfilePhotoGallery>
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
                              {profile.genderLabel ? (
                                <p className="mt-1 text-xs font-semibold text-[#607265]">
                                  {profile.genderLabel}
                                </p>
                              ) : null}
                            </div>
                            <span
                              className={cx(
                                "flex min-h-10 max-w-28 shrink-0 items-center justify-center rounded-md px-2 text-center text-[11px] font-bold leading-4 text-[#17201b]",
                                profile.accent,
                              )}
                            >
                              {getMatchLabel(profile.match)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-[#34443a]">
                            {profile.personalitySummary}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <VerificationBadges
                              compact
                              verification={profile.verification}
                            />
                            {profile.isPremium ? (
                              <PremiumBadge compact label="Tribe Plus" />
                            ) : null}
                            {profile.hasActiveBoost ? (
                              <PremiumBadge boost compact />
                            ) : null}
                            {profile.isRecentlyActive ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#fff4d8] px-2 py-1 text-xs font-semibold text-[#75520d]">
                                <Sparkles size={13} />
                                Recently active
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-[#4e5e54]">
                        {profile.signal}
                      </p>

                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold uppercase text-[#607265]">
                          Why you may connect
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

                    </div>

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
                        {isSaved ? "Liked" : "Like"}
                      </button>
                      <Link
                        className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
                        href={`/profiles/${profile.id}?from=people`}
                        aria-label={`View ${profile.name}`}
                      >
                        <Eye size={18} />
                        View profile
                      </Link>
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
              isPending={pendingActionProfileId === selectedProfile.id}
              isSaved={
                savedIds.includes(selectedProfile.id) || selectedProfile.isSaved
              }
              onPass={() => passProfile(selectedProfile.id)}
              onSave={() => saveProfile(selectedProfile.id)}
              profile={selectedProfile}
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
  isPending,
  isSaved,
  onPass,
  onSave,
  profile,
}: {
  isPending: boolean;
  isSaved: boolean;
  onPass: () => void;
  onSave: () => void;
  profile: DiscoveryProfile;
}) {
  return (
    <div className="rounded-lg border border-[#d8ded1] bg-[#fbfaf4] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <ProfilePhotoGallery
          label={`View ${profile.name}'s profile photos`}
          photos={profile.photos.length ? profile.photos : [profile.image]}
        >
          <SafeStorageImage
            alt={`${profile.name} avatar`}
            className="h-20 w-20 rounded-md object-cover"
            height={80}
            src={profile.image}
            width={80}
          />
        </ProfilePhotoGallery>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#607265]">Selected person</p>
          <h2 className="mt-1 text-xl font-semibold">
            {profile.name}
            {profile.age ? `, ${profile.age}` : ""}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#607265]">
            <span>{profile.city}</span>
            {profile.genderLabel ? (
              <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold">
                {profile.genderLabel}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <VerificationBadges compact verification={profile.verification} />
            {profile.isPremium ? <PremiumBadge compact label="Tribe Plus" /> : null}
            {profile.hasActiveBoost ? <PremiumBadge boost compact /> : null}
            <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#607265]">
              <Sparkles size={13} />
              {profile.activityLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-[#e2e6dc] bg-white p-3">
        <p className="text-sm font-semibold text-[#607265]">
          {getMatchLabel(profile.match)}
        </p>
        <p className="mt-1 text-sm leading-6 text-[#34443a]">
          {profile.personalitySummary}
        </p>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-[#607265]">
          Why you may connect
        </p>
        <div className="mt-3 space-y-2">
          {profile.reasons.slice(0, 2).map((reason) => (
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

      <div className="mt-5 grid grid-cols-[1fr_76px_44px] gap-2">
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
          {isSaved ? "Liked" : "Like Profile"}
        </button>
        <Link
          className="flex h-11 items-center justify-center gap-1 rounded-md border border-[#cbd4c6] bg-white text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
          href={`/profiles/${profile.id}?from=people`}
          aria-label={`View ${profile.name}`}
        >
          <Eye size={17} />
          View
        </Link>
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

function PeopleFilterPanel({
  draft,
  onApply,
  onChange,
  onReset,
}: {
  draft: DiscoveryFilters;
  onApply: () => void;
  onChange: (filters: DiscoveryFilters) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
            <SlidersHorizontal size={16} />
            People filters
          </p>
          <p className="mt-1 text-sm leading-6 text-[#34443a]">
            Basic filters affect People only. Community spaces remain open to
            everyone.
          </p>
        </div>
        <span className="w-fit rounded-md bg-[#eef7f1] px-2 py-1 text-xs font-bold uppercase text-[#176b57]">
          Free basics
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-sm font-semibold text-[#34443a]">Gender</span>
          <select
            aria-label="Filter People by gender"
            className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm text-[#17201b] outline-none transition focus:border-[#17251f]"
            onChange={(event) =>
              onChange({
                ...draft,
                gender: event.target.value as DiscoveryFilters["gender"],
              })
            }
            value={draft.gender}
          >
            <option value="all">Any gender</option>
            {genderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#34443a]">
            Minimum age
          </span>
          <input
            aria-label="Minimum age"
            className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm text-[#17201b] outline-none transition focus:border-[#17251f]"
            inputMode="numeric"
            max={120}
            min={18}
            onChange={(event) =>
              onChange({ ...draft, minAge: event.target.value })
            }
            placeholder="18"
            type="number"
            value={draft.minAge}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#34443a]">
            Maximum age
          </span>
          <input
            aria-label="Maximum age"
            className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm text-[#17201b] outline-none transition focus:border-[#17251f]"
            inputMode="numeric"
            max={120}
            min={18}
            onChange={(event) =>
              onChange({ ...draft, maxAge: event.target.value })
            }
            placeholder="35"
            type="number"
            value={draft.maxAge}
          />
        </label>
      </div>

      <div className="mt-4 rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3">
        <p className="text-sm font-semibold text-[#607265]">
          Advanced filters
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {advancedFilterLabels.map((label) => (
            <button
              aria-label={`${label} filter locked for Tribe Plus`}
              className="flex h-10 items-center justify-between rounded-md border border-[#d8ded1] bg-white px-3 text-sm font-semibold text-[#7c8b80] opacity-75"
              disabled
              key={label}
              type="button"
            >
              {label}
              <span className="rounded-md bg-[#f6c66f] px-2 py-0.5 text-[11px] font-bold uppercase text-[#17201b]">
                Premium
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
        <button
          className="flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
          onClick={onApply}
          type="button"
        >
          Apply filters
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
        People will fill in as members complete profiles.
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
        People only shows members who completed onboarding, reached profile
        quality, stayed visible, and passed safety filters. Try widening your
        filters, finish your own profile, or check back as more members become
        discoverable.
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
          href="/explore?tab=passed"
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
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
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
              {error ? "People is paused" : "Checking recommendations"}
            </p>
            <h1 className="mt-1 text-xl font-semibold">
              {error ? "People needs attention" : "Preparing Tribe"}
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
