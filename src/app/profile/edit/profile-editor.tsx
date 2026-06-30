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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  OwnedProfile,
  ProfileQualitySnapshot,
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
  region: string;
  visibility: "private" | "members" | "discoverable";
};

type ProfileEditorProps = {
  profile: EditableProfile;
  quality: ProfileQualitySnapshot;
};

export default function ProfileEditor({
  profile,
  quality: initialQuality,
}: ProfileEditorProps) {
  const [draft, setDraft] = useState<ProfileDraft>({
    bio: profile.bio ?? "",
    birthdate: profile.birthdate ?? "",
    city: profile.city ?? "",
    country: profile.country ?? "",
    discoverable: profile.discoverable,
    displayName: profile.display_name ?? "",
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
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceDuration, setVoiceDuration] = useState<number | null>(
    profile.voice_intro_duration_seconds,
  );
  const [pendingAction, setPendingAction] = useState<
    "profile" | "photos" | "prompts" | "voice" | null
  >(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const voiceReady = Boolean(
    voiceFile && voiceDuration && voiceDuration >= 30 && voiceDuration <= 60,
  );
  const photosRemaining = Math.max(0, 6 - quality.photos.length);
  const completionTone =
    quality.completeness >= 80 ? "text-[#2f5f36]" : "text-[#8a3325]";
  const photosNeeded = Math.max(
    0,
    quality.minimumPhotoCount - quality.uploadedPhotoCount,
  );

  const sortedPhotos = useMemo(
    () =>
      [...quality.photos].sort(
        (left, right) => left.sort_order - right.sort_order,
      ),
    [quality.photos],
  );

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

      setMessage("Profile saved.");
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

  async function uploadPhotos() {
    if (photoFiles.length === 0) {
      return;
    }

    setPendingAction("photos");
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      photoFiles.slice(0, photosRemaining).forEach((file) => {
        formData.append("photos", file);
      });
      const response = await fetch("/api/profile/photos", {
        body: formData,
        method: "POST",
      });
      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(responseBody?.error ?? "Photos could not be uploaded.");
      }

      setQuality(responseBody as ProfileQualitySnapshot);
      setPhotoFiles([]);
      setMessage("Profile photos uploaded.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Photos could not be uploaded.",
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
      setMessage("Profile prompts saved.");
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
      setMessage("Voice introduction uploaded.");
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
              Discovery
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">Edit profile</h1>
            <p className="mt-2 text-sm leading-6 text-[#34443a]">
              Profiles must reach 80% completeness before discovery opens.
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
            <section className="space-y-5">
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
            </section>

            <section className="space-y-4 border-t border-[#d8ded1] pt-6">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-[#34443a]">
                  <ImagePlus size={16} />
                  Profile photos
                </p>
                <p className="mt-1 text-sm leading-6 text-[#607265]">
                  Upload at least 3 photos to unlock discovery. Add up to 6
                  photos; the first photo becomes your discovery image.
                </p>
              </div>
              {sortedPhotos.length ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {sortedPhotos.map((photo) => (
                    <Image
                      alt={photo.alt_text ?? "Profile photo"}
                      className="aspect-square rounded-md object-cover"
                      height={120}
                      key={photo.id}
                      src={photo.image_url}
                      width={120}
                    />
                  ))}
                </div>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  accept="image/*"
                  disabled={photosRemaining === 0}
                  multiple
                  onChange={(event) =>
                    setPhotoFiles(Array.from(event.target.files ?? []))
                  }
                  type="file"
                />
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
                  disabled={
                    pendingAction === "photos" ||
                    photosRemaining === 0 ||
                    photoFiles.length === 0
                  }
                  onClick={uploadPhotos}
                  type="button"
                >
                  {pendingAction === "photos" ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : (
                    <ImagePlus size={16} />
                  )}
                  Upload photos
                </button>
              </div>
            </section>

            <section className="space-y-4 border-t border-[#d8ded1] pt-6">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-[#34443a]">
                  <Mic size={16} />
                  Voice introduction
                </p>
                <p className="mt-1 text-sm leading-6 text-[#607265]">
                  Optional, 30 to 60 seconds.
                </p>
              </div>
              {profile.voice_intro_url ? (
                <audio className="w-full" controls src={profile.voice_intro_url} />
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

            <section className="space-y-4 border-t border-[#d8ded1] pt-6">
              <div>
                <p className="text-sm font-semibold text-[#34443a]">
                  Profile prompts
                </p>
                <p className="mt-1 text-sm leading-6 text-[#607265]">
                  Answer at least two prompts to help people understand your
                  rhythm.
                </p>
              </div>
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
              {quality.completeness < 80 ? (
                <p className="mt-3 text-sm leading-6 text-[#8a3325]">
                  {quality.hasMinimumPhotos
                    ? "Discovery unlocks at 80%."
                    : "Upload at least 3 photos to unlock discovery."}
                </p>
              ) : (
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#2f5f36]">
                  <Check size={15} />
                  Discovery ready
                </p>
              )}
            </section>

            {!quality.hasMinimumPhotos ? (
              <section className="rounded-md border border-[#ef8f7a] bg-white p-4">
                <p className="text-sm font-semibold text-[#8a3325]">
                  Upload at least 3 photos to unlock discovery.
                </p>
                <p className="mt-2 text-sm leading-6 text-[#34443a]">
                  {photosNeeded} more photo{photosNeeded === 1 ? "" : "s"}{" "}
                  needed before you can appear in recommendations, save
                  profiles, or start conversations.
                </p>
              </section>
            ) : null}

            <section className="rounded-md border border-[#d8ded1] bg-white p-4">
              <p className="text-sm font-semibold text-[#607265]">
                Completion checklist
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
                    <span className="font-semibold">{item.points}</span>
                  </div>
                ))}
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
