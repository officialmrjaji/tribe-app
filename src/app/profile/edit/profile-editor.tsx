"use client";

import { ArrowLeft, Eye, LoaderCircle, MapPin, Save, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { OwnedProfile } from "@/lib/profile/service";

type EditableProfile = OwnedProfile["profile"];

type ProfileDraft = {
  bio: string;
  city: string;
  country: string;
  discoverable: boolean;
  displayName: string;
  region: string;
  visibility: "private" | "members" | "discoverable";
};

export default function ProfileEditor({ profile }: { profile: EditableProfile }) {
  const [draft, setDraft] = useState<ProfileDraft>({
    bio: profile.bio ?? "",
    city: profile.city ?? "",
    country: profile.country ?? "",
    discoverable: profile.discoverable,
    displayName: profile.display_name ?? "",
    region: profile.region ?? "",
    visibility: profile.visibility,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/profile", {
        body: JSON.stringify({
          bio: draft.bio,
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

      setMessage("Profile saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Profile could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
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
          </div>
          <button
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#17251f] px-5 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:bg-[#9ba89f]"
            disabled={isSaving}
            onClick={saveProfile}
            type="button"
          >
            {isSaving ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <Save size={17} />
            )}
            Save profile
          </button>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
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

            <div className="grid gap-4 sm:grid-cols-3">
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
            </div>
          </div>

          <aside className="space-y-5">
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
