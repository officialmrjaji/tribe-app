"use client";

import {
  ArrowLeft,
  Clock,
  Eye,
  Headphones,
  LoaderCircle,
  Mic,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { VoiceIntroPlayer } from "@/components/voice/voice-intro-player";
import type { VoiceSessionSummary } from "@/lib/voice/service";

type VoiceSessionPayload = {
  error?: string;
  session?: VoiceSessionSummary;
};

export default function VoiceSessionClient({
  initialSession,
}: {
  initialSession: VoiceSessionSummary;
}) {
  const [session, setSession] = useState(initialSession);
  const [pendingAction, setPendingAction] = useState<"mic" | "reveal" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => new Date(session.startedAt).getTime());
  const remainingMs = Math.max(
    0,
    new Date(session.revealProfilesAfter).getTime() - now,
  );
  const canReveal = session.canReveal || remainingMs === 0;
  const timerLabel = useMemo(() => formatDuration(remainingMs), [remainingMs]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function checkMicrophone() {
    setPendingAction("mic");
    setError("");
    setMessage("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      stream.getTracks().forEach((track) => track.stop());
      setMessage("Microphone is ready. Video was not requested.");
    } catch {
      setError("Microphone permission is needed for voice sessions.");
    } finally {
      setPendingAction(null);
    }
  }

  async function revealProfiles() {
    setPendingAction("reveal");
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/voice/sessions/${session.id}/reveal`, {
        headers: { Accept: "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceSessionPayload
        | null;

      if (!response.ok || !payload?.session) {
        throw new Error(payload?.error ?? "Unable to reveal profile.");
      }

      setSession(payload.session);
      setMessage("Profile revealed.");
    } catch (revealError) {
      setError(
        revealError instanceof Error
          ? revealError.message
          : "Unable to reveal profile.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/voice"
            >
              <ArrowLeft size={16} />
              Voice
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Mic size={16} />
              Random voice match
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Five minutes, profile reveal after.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              This session is matched by personality, interests, and language
              signals. Keep it voice-only; video is not used.
            </p>
          </div>
          <button
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6] disabled:opacity-60"
            disabled={pendingAction === "mic"}
            onClick={checkMicrophone}
            type="button"
          >
            {pendingAction === "mic" ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Headphones size={16} />
            )}
            Mic check
          </button>
        </header>

        {message ? <Notice message={message} tone="success" /> : null}
        {error ? <Notice message={error} tone="error" /> : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-md bg-[#17251f] text-white">
                <Mic size={24} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#607265]">
                  Session status
                </p>
                <h2 className="mt-1 text-3xl font-semibold">{timerLabel}</h2>
              </div>
            </div>
            <div className="mt-5 rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
                <Clock size={16} />
                Reveal rule
              </p>
              <p className="mt-2 text-sm leading-6 text-[#34443a]">
                Profiles reveal after the 5-minute timer ends. Until then, keep
                the conversation focused on voice, pace, and shared signals.
              </p>
            </div>
            <div className="mt-5 space-y-2">
              {session.matchingBasis.map((reason) => (
                <p
                  className="flex gap-2 rounded-md border border-[#e2e6dc] px-3 py-2 text-sm leading-5 text-[#34443a]"
                  key={reason}
                >
                  <ShieldCheck className="mt-0.5 text-[#587d62]" size={15} />
                  {reason}
                </p>
              ))}
              {session.languageSignal ? (
                <p className="rounded-md border border-[#e2e6dc] px-3 py-2 text-sm font-semibold text-[#607265]">
                  Language signal: {session.languageSignal}
                </p>
              ) : null}
            </div>
            <button
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
              disabled={!canReveal || pendingAction === "reveal"}
              onClick={revealProfiles}
              type="button"
            >
              {pendingAction === "reveal" ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Eye size={16} />
              )}
              Reveal profile
            </button>
          </div>

          <aside className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <UserRound size={16} />
              Profile reveal
            </p>
            {session.otherProfile ? (
              <div className="mt-4">
                <h2 className="text-xl font-semibold">
                  {session.otherProfile.name}
                </h2>
                <p className="mt-1 text-sm text-[#607265]">
                  {session.otherProfile.city}
                </p>
                {session.otherProfile.voiceIntroUrl ? (
                  <div className="mt-4">
                    <VoiceIntroPlayer
                      durationSeconds={
                        session.otherProfile.voiceIntroDurationSeconds
                      }
                      label={`${session.otherProfile.name} voice intro`}
                      src={session.otherProfile.voiceIntroUrl}
                    />
                  </div>
                ) : null}
                <Link
                  className="mt-4 flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
                  href={`/profiles/${session.otherProfile.profileId}`}
                >
                  Open profile
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#34443a]">
                The profile stays hidden until the session is ready to reveal.
              </p>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Notice({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success";
}) {
  return (
    <p
      className={
        tone === "error"
          ? "mt-4 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]"
          : "mt-4 rounded-md border border-[#94c973] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f36]"
      }
    >
      {message}
    </p>
  );
}

function formatDuration(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `${minutes}:${seconds}`;
}
