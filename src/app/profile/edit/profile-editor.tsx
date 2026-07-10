"use client";

import {
  ArrowLeft,
  Check,
  Eye,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Mic,
  Save,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProfilePhotoManager } from "@/components/profile/profile-photo-manager";
import { VerificationBadges } from "@/components/profile/verification-badges";
import { VoiceIntroPlayer } from "@/components/voice/voice-intro-player";
import {
  availabilityLabels,
  conversationStyleLabels,
  genderOptions,
  intentLabels,
  interestLabels,
  lifestyleSignalLabels,
  personalityTypeLabels,
  type Gender,
} from "@/lib/onboarding/options";
import type { OnboardingSnapshot } from "@/lib/onboarding/service";
import type {
  OwnedProfile,
  ProfileQualitySnapshot,
  ProfileVerification,
} from "@/lib/profile/service";

const profilePromptOptions = [
  {
    key: "perfect_weekend",
    text: "A perfect weekend is...",
  },
  {
    key: "people_notice",
    text: "People usually notice that I...",
  },
  {
    key: "looking_for",
    text: "Right now I am looking for...",
  },
] as const;

type EditableProfile = OwnedProfile["profile"];

type ProfileDraft = {
  bio: string;
  birthdate: string;
  city: string;
  country: string;
  discoverable: boolean;
  displayName: string;
  gender: Gender | "";
  region: string;
  visibility: "private" | "members" | "discoverable";
};

type ProfileEditorProps = {
  onboarding: OnboardingSnapshot | null;
  profile: EditableProfile;
  quality: ProfileQualitySnapshot;
  verification: ProfileVerification;
};

export default function ProfileEditor({
  onboarding,
  profile,
  quality: initialQuality,
  verification,
}: ProfileEditorProps) {
  const [draft, setDraft] = useState<ProfileDraft>({
    bio: profile.bio ?? "",
    birthdate: profile.birthdate ?? "",
    city: profile.city ?? "",
    country: profile.country ?? "",
    discoverable: profile.discoverable,
    displayName: profile.display_name ?? "",
    gender: profile.gender ?? "",
    region: profile.region ?? "",
    visibility: profile.visibility,
  });
  const [quality, setQuality] = useState(initialQuality);
  const [promptDrafts, setPromptDrafts] = useState(() =>
    profilePromptOptions.map((option) => ({
      answer:
        initialQuality.prompts.find((prompt) => prompt.prompt_key === option.key)
          ?.answer ?? "",
      promptKey: option.key,
      promptText: option.text,
    })),
  );
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceDuration, setVoiceDuration] = useState<number | null>(
    profile.voice_intro_duration_seconds,
  );
  const [pendingAction, setPendingAction] = useState<
    "profile" | "prompts" | "voice" | null
  >(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const voiceReady = Boolean(
    voiceFile && voiceDuration && voiceDuration >= 30 && voiceDuration <= 60,
  );
  const completionTone =
    quality.completeness >= 50 ? "text-[#2f5f36]" : "text-[#8a3325]";
  const photosNeeded = Math.max(
    0,
    quality.minimumPhotoCount - quality.uploadedPhotoCount,
  );

  const languageSignals =
    onboarding?.interests.includes("languages") ||
    onboarding?.intent === "language_exchange"
      ? ["Language exchange"]
      : [];

  function updateDraft(update: Partial<ProfileDraft>) {
    setDraft((current) => ({ ...current, ...update }));
    setMessage("");
    setError("");
  }

  function updateVisibility(visibility: ProfileDraft["visibility"]) {
    updateDraft({
      discoverable: visibility === "private" ? false : draft.discoverable,
      visibility,
    });
  }

  function toggleDiscoverable() {
    const discoverable = !draft.discoverable;

    updateDraft({
      discoverable,
      visibility:
        discoverable && draft.visibility === "private"
          ? "discoverable"
          : draft.visibility,
    });
  }

  async function saveProfile() {
    setPendingAction("profile");
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/profile", {
        body: JSON.stringify({
          bio: draft.bio,
          birthdate: draft.birthdate || null,
          city: draft.city,
          country: draft.country,
          discoverable: draft.discoverable,
          displayName: draft.displayName,
          gender: draft.gender || null,
          region: draft.region,
          visibility: draft.visibility,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseBody?.error ?? "Profile could not be saved.");
      }

      if (responseBody?.quality) {
        setQuality(responseBody.quality as ProfileQualitySnapshot);
      }

      setMessage("Profile saved successfully.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Profile could not be saved.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function savePrompts() {
    setPendingAction("prompts");
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/profile/prompts", {
        body: JSON.stringify({
          prompts: promptDrafts.map((prompt) => ({
            answer: prompt.answer,
            promptKey: prompt.promptKey,
          })),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseBody?.error ?? "Prompts could not be saved.");
      }

      setQuality(responseBody as ProfileQualitySnapshot);
      setMessage("Profile prompts saved successfully.");
    } catch (promptError) {
      setError(
        promptError instanceof Error
          ? promptError.message
          : "Prompts could not be saved.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function uploadVoice() {
    if (!voiceFile || !voiceDuration) {
      return;
    }

    setPendingAction("voice");
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("voice", voiceFile);
      formData.append("durationSeconds", String(Math.round(voiceDuration)));
      const response = await fetch("/api/profile/voice", {
        body: formData,
        method: "POST",
      });
      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          responseBody?.error ?? "Voice introduction could not be uploaded.",
        );
      }

      setQuality(responseBody as ProfileQualitySnapshot);
      setVoiceFile(null);
      setMessage("Voice introduction uploaded successfully.");
    } catch (voiceError) {
      setError(
        voiceError instanceof Error
          ? voiceError.message
          : "Voice introduction could not be uploaded.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function selectVoiceFile(file: File | undefined) {
    if (!file) {
      setVoiceFile(null);
      setVoiceDuration(profile.voice_intro_duration_seconds);
      return;
    }

    setVoiceFile(file);
    setVoiceDuration(null);
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      setVoiceDuration(audio.duration);
    };
    audio.src = url;
  }

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
            <h1 className="mt-2 text-2xl font-semibold">Edit profile</h1>
            <p className="mt-2 text-sm leading-6 text-[#34443a]">
              People opens at 50% with three real photos. Reach 80% or more for
              stronger recommendations and profile visibility.
            </p>
          </div>
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#17251f] px-5 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:bg-[#9ba89f]"
            disabled={pendingAction === "profile"}
            onClick={saveProfile}
            type="button"
          >
            {pendingAction === "profile" ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <Save size={17} />
            )}
            Save profile
          </button>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="space-y-5 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
              <SectionHeader
                eyebrow="About"
                title="Core profile"
                body="Name, location, and bio give people enough context before they like or message."
              />
              <label className="block">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#34443a]">
                  <UserRound size={16} />
                  Display name
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm text-[#17201b] outline-none transition placeholder:text-[#7c8b80] focus:border-[#17251f]"
                  maxLength={120}
                  onChange={(event) =>
                    updateDraft({ displayName: event.target.value })
                  }
                  value={draft.displayName}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#34443a]">Bio</span>
                <textarea
                  className="mt-2 min-h-36 w-full rounded-md border border-[#cbd4c6] bg-white px-3 py-3 text-sm leading-6 text-[#17201b] outline-none transition placeholder:text-[#7c8b80] focus:border-[#17251f]"
                  maxLength={1000}
                  onChange={(event) => updateDraft({ bio: event.target.value })}
                  value={draft.bio}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-4">
                <label className="block">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#34443a]">
                    <MapPin size={16} />
                    City
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm text-[#17201b] outline-none transition focus:border-[#17251f]"
                    maxLength={120}
                    onChange={(event) => updateDraft({ city: event.target.value })}
                    value={draft.city}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#34443a]">
                    Region
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm text-[#17201b] outline-none transition focus:border-[#17251f]"
                    maxLength={120}
                    onChange={(event) =>
                      updateDraft({ region: event.target.value })
                    }
                    value={draft.region}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#34443a]">
                    Country
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm text-[#17201b] outline-none transition focus:border-[#17251f]"
                    maxLength={120}
                    onChange={(event) =>
                      updateDraft({ country: event.target.value })
                    }
                    value={draft.country}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#34443a]">
                    Birthdate
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm text-[#17201b] outline-none transition focus:border-[#17251f]"
                    onChange={(event) =>
                      updateDraft({ birthdate: event.target.value })
                    }
                    type="date"
                    value={draft.birthdate}
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-[#34443a]">
                  Gender
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm text-[#17201b] outline-none transition focus:border-[#17251f]"
                  onChange={(event) =>
                    updateDraft({
                      gender: event.target.value as Gender | "",
                    })
                  }
                  value={draft.gender}
                >
                  <option value="">Choose an option</option>
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs leading-5 text-[#607265]">
                  Used as a private matching foundation. It is not shown as a
                  headline on your public profile.
                </span>
              </label>
            </section>

            <section className="space-y-4 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
              <SectionHeader
                body="Upload, replace, remove, or reorder up to 6 photos. Keep a real photo first; illustrated avatars remain supplementary."
                icon={ImagePlus}
                eyebrow="Photos"
                title="Profile photos"
              />
              <ProfilePhotoManager
                onQualityChange={setQuality}
                quality={quality}
              />
            </section>

            <section className="space-y-4 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
              <SectionHeader
                body="Optional, 30 to 60 seconds. A short voice intro helps people feel your pace before messaging."
                icon={Mic}
                eyebrow="Voice Intro"
                title="Voice introduction"
              />
              {profile.voice_intro_url ? (
                <VoiceIntroPlayer
                  durationSeconds={profile.voice_intro_duration_seconds}
                  label="Current voice intro"
                  src={profile.voice_intro_url}
                />
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  accept="audio/*"
                  onChange={(event) =>
                    selectVoiceFile(event.target.files?.[0] ?? undefined)
                  }
                  type="file"
                />
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
                  disabled={pendingAction === "voice" || !voiceReady}
                  onClick={uploadVoice}
                  type="button"
                >
                  {pendingAction === "voice" ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : (
                    <Mic size={16} />
                  )}
                  Upload voice
                </button>
              </div>
              {voiceDuration ? (
                <p className="text-sm font-semibold text-[#607265]">
                  Selected length: {Math.round(voiceDuration)} seconds
                </p>
              ) : null}
            </section>

            <section className="space-y-4 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
              <SectionHeader
                body="Answer at least two prompts to help people understand your rhythm."
                eyebrow="Prompts"
                title="Profile prompts"
              />
              {promptDrafts.map((prompt, index) => (
                <label className="block" key={prompt.promptKey}>
                  <span className="text-sm font-semibold text-[#34443a]">
                    {prompt.promptText}
                  </span>
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-md border border-[#cbd4c6] bg-white px-3 py-3 text-sm leading-6 text-[#17201b] outline-none transition focus:border-[#17251f]"
                    maxLength={240}
                    onChange={(event) =>
                      setPromptDrafts((currentPrompts) =>
                        currentPrompts.map((currentPrompt, currentIndex) =>
                          currentIndex === index
                            ? { ...currentPrompt, answer: event.target.value }
                            : currentPrompt,
                        ),
                      )
                    }
                    value={prompt.answer}
                  />
                </label>
              ))}
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
                disabled={pendingAction === "prompts"}
                onClick={savePrompts}
                type="button"
              >
                {pendingAction === "prompts" ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Save prompts
              </button>
            </section>

            <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
              <SectionHeader
                body="These read-only signals come from onboarding and shape discovery, matching, and first-message context."
                eyebrow="Profile Signals"
                title="Interests, languages, personality, lifestyle, and goals"
              />
              {onboarding ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SignalGroup
                    label="Interests"
                    values={onboarding.interests.map(
                      (interest) => interestLabels[interest],
                    )}
                  />
                  <SignalGroup
                    label="Languages"
                    values={languageSignals.length ? languageSignals : ["Optional"]}
                  />
                  <SignalGroup
                    label="Personality"
                    values={[
                      personalityTypeLabels[onboarding.personalityType],
                      conversationStyleLabels[onboarding.conversationStyle],
                    ]}
                  />
                  <SignalGroup
                    label="Lifestyle"
                    values={onboarding.lifestyleSignals.map(
                      (signal) => lifestyleSignalLabels[signal],
                    )}
                  />
                  <SignalGroup
                    label="Goals"
                    values={[
                      intentLabels[onboarding.intent],
                      onboarding.primaryGoal,
                    ]}
                  />
                  <SignalGroup
                    label="Availability"
                    values={[availabilityLabels[onboarding.availability]]}
                  />
                </div>
              ) : (
                <p className="mt-4 rounded-md border border-[#e2e6dc] bg-[#fbfaf4] px-3 py-2 text-sm text-[#34443a]">
                  Complete onboarding to fill in your discovery signals.
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-md border border-[#d8ded1] bg-white p-4">
              <p className="text-sm font-semibold text-[#607265]">
                Profile completeness
              </p>
              <p className={`mt-2 text-4xl font-semibold ${completionTone}`}>
                {quality.completeness}%
              </p>
              <div className="mt-3 h-2 rounded-md bg-[#e2e6dc]">
                <div
                  className="h-2 rounded-md bg-[#17251f]"
                  style={{ width: `${quality.completeness}%` }}
                />
              </div>
              {!quality.hasMinimumPhotos ? (
                <p className="mt-3 text-sm leading-6 text-[#8a3325]">
                  Upload at least 3 real profile photos to unlock People.
                </p>
              ) : quality.completeness < 50 ? (
                <p className="mt-3 text-sm leading-6 text-[#8a3325]">
                  Complete at least 50% of your profile to open People.
                </p>
              ) : quality.completeness < 80 ? (
                <p className="mt-3 text-sm leading-6 text-[#34443a]">
                  People is ready. Reach 80% or more for better matching quality
                  and recommendation priority.
                </p>
              ) : (
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#2f5f36]">
                  <Check size={15} />
                  Profile quality ready
                </p>
              )}
            </section>

            {!quality.hasMinimumPhotos ? (
              <section className="rounded-md border border-[#ef8f7a] bg-white p-4">
                <p className="text-sm font-semibold text-[#8a3325]">
                  Upload at least 3 real profile photos to unlock People.
                </p>
                <p className="mt-2 text-sm leading-6 text-[#34443a]">
                  {photosNeeded} more photo{photosNeeded === 1 ? "" : "s"}{" "}
                  needed before you can appear in recommendations, like
                  profiles, or start conversations.
                </p>
              </section>
            ) : null}

            <section className="rounded-md border border-[#d8ded1] bg-white p-4">
              <p className="text-sm font-semibold text-[#607265]">
                Profile completeness checklist
              </p>
              <p className="mt-1 text-sm leading-6 text-[#34443a]">
                Basic access starts at 50% with three real photos. Completing
                more helps people understand you and improves matching quality.
              </p>
              <div className="mt-3 space-y-2">
                {quality.checklist.map((item) => (
                  <div
                    className="flex items-start justify-between gap-3 border-b border-[#e2e6dc] pb-2 text-sm last:border-b-0 last:pb-0"
                    key={item.label}
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck
                        className={
                          item.complete ? "text-[#587d62]" : "text-[#9ba89f]"
                        }
                        size={15}
                      />
                      {item.label}
                    </span>
                    <span className="font-semibold">
                      {item.complete ? "Done" : `${item.points} pts`}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-[#d8ded1] bg-white p-4">
              <p className="text-sm font-semibold text-[#607265]">
                Verification
              </p>
              <p className="mt-1 text-sm leading-6 text-[#34443a]">
                Badges are synced by Tribe systems and cannot be self-assigned.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <VerificationBadges verification={verification} />
              </div>
              <div className="mt-3 space-y-2 text-sm text-[#34443a]">
                <VerificationRow
                  complete={verification.email}
                  label="Email verified"
                />
                <VerificationRow
                  complete={verification.phone}
                  label="Phone verified"
                />
                <VerificationRow
                  complete={verification.identity}
                  label="Identity verified"
                />
              </div>
            </section>

            <label className="block">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#34443a]">
                <Eye size={16} />
                Visibility
              </span>
              <select
                className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#17201b] outline-none transition focus:border-[#17251f]"
                onChange={(event) =>
                  updateVisibility(event.target.value as ProfileDraft["visibility"])
                }
                value={draft.visibility}
              >
                <option value="discoverable">Discoverable</option>
                <option value="members">Members only</option>
                <option value="private">Private</option>
              </select>
            </label>

            <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-[#cbd4c6] bg-white px-3 py-2 text-sm font-semibold">
              <span>Discoverable</span>
              <button
                aria-pressed={draft.discoverable}
                className={[
                  "flex h-8 min-w-20 items-center justify-center rounded-md px-3 text-xs font-bold transition",
                  draft.discoverable
                    ? "bg-[#17251f] text-white"
                    : "border border-[#cbd4c6] bg-[#f6f7f1] text-[#34443a]",
                ].join(" ")}
                onClick={toggleDiscoverable}
                type="button"
              >
                {draft.discoverable ? "On" : "Off"}
              </button>
            </div>

            {message ? (
              <p className="rounded-md border border-[#94c973] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f36]">
                {message}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]">
                {error}
              </p>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  body,
  eyebrow,
  icon: Icon,
  title,
}: {
  body: string;
  eyebrow: string;
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
        {Icon ? <Icon size={16} aria-hidden="true" /> : null}
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-[#17201b]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#607265]">{body}</p>
    </div>
  );
}

function SignalGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3">
      <p className="text-xs font-semibold uppercase text-[#607265]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#34443a]"
            key={value}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function VerificationRow({
  complete,
  label,
}: {
  complete: boolean;
  label: string;
}) {
  return (
    <p className="flex items-center justify-between gap-3 border-b border-[#e2e6dc] pb-2 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <span
        className={
          complete
            ? "font-semibold text-[#2f5f36]"
            : "font-semibold text-[#607265]"
        }
      >
        {complete ? "Verified" : "Pending"}
      </span>
    </p>
  );
}
