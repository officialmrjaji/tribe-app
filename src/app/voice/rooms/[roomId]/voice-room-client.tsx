"use client";

import {
  ArrowLeft,
  CalendarDays,
  Headphones,
  LoaderCircle,
  Lock,
  Mic,
  Radio,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { VoiceIntroPlayer } from "@/components/voice/voice-intro-player";
import type { VoiceRoomSummary } from "@/lib/voice/service";

type VoiceRoomPayload = {
  error?: string;
  room?: VoiceRoomSummary;
};

export default function VoiceRoomClient({
  initialRoom,
}: {
  initialRoom: VoiceRoomSummary;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [inviteCode, setInviteCode] = useState("");
  const [pendingAction, setPendingAction] = useState<"join" | "mic" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
      setError("Microphone permission is needed for voice rooms.");
    } finally {
      setPendingAction(null);
    }
  }

  async function joinRoom() {
    setPendingAction("join");
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/voice/rooms/${room.id}/join`, {
        body: JSON.stringify({
          inviteCode: inviteCode || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceRoomPayload
        | null;

      if (!response.ok || !payload?.room) {
        throw new Error(payload?.error ?? "Unable to join room.");
      }

      setRoom(payload.room);
      setMessage("You joined the voice room.");
    } catch (joinError) {
      setError(
        joinError instanceof Error ? joinError.message : "Unable to join room.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/voice"
            >
              <ArrowLeft size={16} />
              Voice Rooms
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              {room.roomType === "private" ? (
                <Lock size={16} />
              ) : room.roomType === "scheduled" ? (
                <CalendarDays size={16} />
              ) : (
                <Radio size={16} />
              )}
              {toTitle(room.roomType)} voice room
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{room.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              {room.description ??
                "A voice-only space for a calm, personality-first conversation."}
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

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Mic size={16} />
              Room stage
            </p>
            <div className="mt-4 rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-4">
              <p className="text-sm leading-6 text-[#34443a]">
                TribeApp keeps this room voice-only. The current release checks
                microphone access and manages room membership; video is not
                requested.
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Status" value={room.status} />
              <Stat label="People" value={`${room.participantCount}/${room.maxParticipants}`} />
              <Stat
                label="Scheduled"
                value={room.scheduledAt ? formatDate(room.scheduledAt) : "Now"}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {room.topic ? <Tag value={room.topic} /> : null}
              {room.language ? <Tag value={room.language} /> : null}
              {room.isHost ? <Tag value="Host" /> : null}
              {room.isMember ? <Tag value="Joined" /> : null}
            </div>
            {!room.isMember ? (
              <div className="mt-5 rounded-md border border-[#e2e6dc] bg-white p-3">
                {room.roomType === "private" ? (
                  <input
                    className="h-10 w-full rounded-md border border-[#cbd4c6] px-3 text-sm outline-none focus:border-[#17251f]"
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="Invite code"
                    value={inviteCode}
                  />
                ) : null}
                <button
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
                  disabled={pendingAction === "join"}
                  onClick={joinRoom}
                  type="button"
                >
                  {pendingAction === "join" ? (
                    <LoaderCircle className="animate-spin" size={16} />
                  ) : (
                    <Mic size={16} />
                  )}
                  Join room
                </button>
              </div>
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
                <Users size={16} />
                Participants
              </p>
              <div className="mt-3 space-y-3">
                {room.participants.length === 0 ? (
                  <p className="text-sm leading-6 text-[#34443a]">
                    No one has joined yet.
                  </p>
                ) : null}
                {room.participants.map((participant) => (
                  <div
                    className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3"
                    key={participant.userId}
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <UserRound size={15} />
                      {participant.name}
                    </p>
                    <p className="mt-1 text-sm text-[#607265]">
                      {participant.city}
                    </p>
                    {participant.voiceIntroUrl ? (
                      <div className="mt-3">
                        <VoiceIntroPlayer
                          durationSeconds={participant.voiceIntroDurationSeconds}
                          label={`${participant.name} voice intro`}
                          src={participant.voiceIntroUrl}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3">
      <p className="text-xs font-semibold uppercase text-[#607265]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#17201b]">{value}</p>
    </div>
  );
}

function Tag({ value }: { value: string }) {
  return (
    <span className="rounded-md bg-[#fbfaf4] px-2 py-1 text-xs font-semibold text-[#607265]">
      {value}
    </span>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Soon";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
