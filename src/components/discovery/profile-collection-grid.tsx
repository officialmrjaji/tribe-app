"use client";

import {
  CalendarDays,
  Heart,
  LoaderCircle,
  MapPin,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { DiscoveryCollectionProfile } from "@/lib/discovery/service";

type ProfileCollectionGridProps = {
  accentLabel: string;
  profiles: DiscoveryCollectionProfile[];
  restorePassed?: boolean;
};

type ApiErrorPayload = {
  error?: string;
  issues?: Array<{
    message?: string;
  }>;
};

export function ProfileCollectionGrid({
  accentLabel,
  profiles,
  restorePassed = false,
}: ProfileCollectionGridProps) {
  const [visibleProfiles, setVisibleProfiles] = useState(profiles);
  const [restoringProfileId, setRestoringProfileId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function restoreProfile(profile: DiscoveryCollectionProfile) {
    setRestoringProfileId(profile.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/profile/pass/restore", {
        body: JSON.stringify({ profileId: profile.id }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getActionFailureMessage(payload, "Profile could not be restored."),
        );
      }

      setVisibleProfiles((currentProfiles) =>
        currentProfiles.filter(
          (currentProfile) => currentProfile.id !== profile.id,
        ),
      );
      setMessage(`${profile.name} was restored to discovery.`);
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Profile could not be restored.",
      );
    } finally {
      setRestoringProfileId(null);
    }
  }

  return (
    <>
      {message ? (
        <p
          className="mt-6 rounded-md border border-[#94c973] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f36]"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {error ? (
        <p
          className="mt-6 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {visibleProfiles.length === 0 ? (
        <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#607265]">
            Restore complete
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            All visible passed profiles are restored.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
            Restored profiles can appear in discovery again when they match the
            current recommendation filters.
          </p>
          <Link
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
            href="/"
          >
            Open discovery
          </Link>
        </section>
      ) : (
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleProfiles.map((profile) => (
            <article
              className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm"
              key={profile.id}
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
                      <h2 className="truncate text-lg font-semibold">
                        {profile.name}
                        {profile.age ? `, ${profile.age}` : ""}
                      </h2>
                      <p className="mt-1 flex items-center gap-1 text-sm text-[#607265]">
                        <MapPin size={14} />
                        {profile.city}
                      </p>
                    </div>
                    <span
                      className={[
                        "flex h-10 w-12 shrink-0 items-center justify-center rounded-md text-sm font-bold text-[#17201b]",
                        profile.accent,
                      ].join(" ")}
                    >
                      {profile.match}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-[#34443a]">
                    {profile.archetype}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-[#4e5e54]">
                {profile.signal}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 border-y border-[#e2e6dc] py-4">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#607265]">
                    <CalendarDays size={14} />
                    Social pace
                  </p>
                  <p className="mt-1 text-sm font-semibold">{profile.pace}</p>
                </div>
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#607265]">
                    <Heart size={14} />
                    {accentLabel}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatDate(profile.actedAt)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
                  <Sparkles size={15} />
                  Match reasons
                </p>
                <div className="mt-2 space-y-2">
                  {profile.reasons.slice(0, 3).map((reason) => (
                    <p
                      className="flex gap-2 rounded-md border border-[#e2e6dc] bg-[#fbfaf4] px-3 py-2 text-sm leading-5 text-[#34443a]"
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

              {restorePassed ? (
                <button
                  className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
                  disabled={restoringProfileId === profile.id}
                  onClick={() => restoreProfile(profile)}
                  type="button"
                >
                  {restoringProfileId === profile.id ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : (
                    <RefreshCcw size={16} />
                  )}
                  Restore to discovery
                </button>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </>
  );
}

function getActionFailureMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const actionPayload = payload as ApiErrorPayload;
  const firstIssue = actionPayload.issues?.[0]?.message;

  return [actionPayload.error, firstIssue].filter(Boolean).join(" ") || fallback;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}
