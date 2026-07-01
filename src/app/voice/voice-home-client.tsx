"use client";

import {
  ArrowLeft,
  CalendarDays,
  Headphones,
  LoaderCircle,
  Lock,
  Mic,
  Plus,
  Radio,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VoiceRoomSummary } from "@/lib/voice/service";

type VoiceHomeClientProps = {
  initialRooms: VoiceRoomSummary[];
};

type ApiErrorPayload = {
  error?: string;
  issues?: Array<{
    message?: string;
  }>;
};

type VoiceMatchPayload = {
  session?: {
    id: string;
  };
} & ApiErrorPayload;

type VoiceRoomPayload = {
  room?: VoiceRoomSummary;
} & ApiErrorPayload;

const roomTypeOptions = [
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
  { label: "Scheduled", value: "scheduled" },
] as const;

export default function VoiceHomeClient({ initialRooms }: VoiceHomeClientProps) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [pendingAction, setPendingAction] = useState<
    "create" | "join" | "match" | "mic" | null
  >(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [inviteCodes, setInviteCodes] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    description: "",
    language: "",
    maxParticipants: 12,
    roomType: "public",
    scheduledAt: "",
    title: "",
    topic: "",
  });

  async function startVoiceMatch() {
    setPendingAction("match");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/voice/match", {
        headers: { Accept: "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceMatchPayload
        | null;

      if (!response.ok || !payload?.session?.id) {
        throw new Error(
          getFailureMessage(payload, "Unable to start voice match."),
        );
      }

      router.push(`/voice/match/${payload.session.id}`);
    } catch (matchError) {
      setError(
        matchError instanceof Error
          ? matchError.message
          : "Unable to start voice match.",
      );
    } finally {
      setPendingAction(null);
    }
  }

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
      setMessage("Microphone is available. Video was not requested.");
    } catch {
      setError("Microphone permission is needed for voice sessions.");
    } finally {
      setPendingAction(null);
    }
  }

  async function createRoom() {
    setPendingAction("create");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/voice/rooms", {
        body: JSON.stringify({
          description: form.description,
          language: form.language,
          maxParticipants: Number(form.maxParticipants),
          roomType: form.roomType,
          scheduledAt: form.scheduledAt
            ? new Date(form.scheduledAt).toISOString()
            : null,
          title: form.title,
          topic: form.topic,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceRoomPayload
        | null;

      if (!response.ok || !payload?.room) {
        throw new Error(
          getFailureMessage(payload, "Unable to create voice room."),
        );
      }

      setRooms((currentRooms) => [payload.room as VoiceRoomSummary, ...currentRooms]);
      setMessage(`${payload.room.title} is ready.`);
      router.push(`/voice/rooms/${payload.room.id}`);
    } catch (roomError) {
      setError(
        roomError instanceof Error
          ? roomError.message
          : "Unable to create voice room.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function joinRoom(room: VoiceRoomSummary) {
    setPendingAction("join");
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/voice/rooms/${room.id}/join`, {
        body: JSON.stringify({
          inviteCode: inviteCodes[room.id] || undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceRoomPayload
        | null;

      if (!response.ok || !payload?.room) {
        throw new Error(getFailureMessage(payload, "Unable to join room."));
      }

      router.push(`/voice/rooms/${room.id}`);
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
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/"
            >
              <ArrowLeft size={16} />
              Discovery
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Mic size={16} />
              Voice
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Meet by voice first, reveal profiles after.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              Random voice matches last 5 minutes. Rooms can be public, private,
              or scheduled. Video is not used.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
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
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
              disabled={pendingAction === "match"}
              onClick={startVoiceMatch}
              type="button"
            >
              {pendingAction === "match" ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Radio size={16} />
              )}
              Random match
            </button>
          </div>
        </header>

        {message ? <Notice message={message} tone="success" /> : null}
        {error ? <Notice message={error} tone="error" /> : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Plus size={16} />
              Create room
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-sm font-semibold text-[#34443a]">
                  Title
                </span>
                <input
                  className="mt-2 h-10 w-full rounded-md border border-[#cbd4c6] px-3 text-sm outline-none focus:border-[#17251f]"
                  maxLength={120}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  value={form.title}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#34443a]">
                  Type
                </span>
                <select
                  className="mt-2 h-10 w-full rounded-md border border-[#cbd4c6] px-3 text-sm font-semibold outline-none focus:border-[#17251f]"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      roomType: event.target.value,
                    }))
                  }
                  value={form.roomType}
                >
                  {roomTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#34443a]">
                    Topic
                  </span>
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cbd4c6] px-3 text-sm outline-none focus:border-[#17251f]"
                    maxLength={120}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        topic: event.target.value,
                      }))
                    }
                    value={form.topic}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#34443a]">
                    Language
                  </span>
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cbd4c6] px-3 text-sm outline-none focus:border-[#17251f]"
                    maxLength={80}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        language: event.target.value,
                      }))
                    }
                    value={form.language}
                  />
                </label>
              </div>
              {form.roomType === "scheduled" ? (
                <label className="block">
                  <span className="text-sm font-semibold text-[#34443a]">
                    Scheduled time
                  </span>
                  <input
                    className="mt-2 h-10 w-full rounded-md border border-[#cbd4c6] px-3 text-sm outline-none focus:border-[#17251f]"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        scheduledAt: event.target.value,
                      }))
                    }
                    type="datetime-local"
                    value={form.scheduledAt}
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="text-sm font-semibold text-[#34443a]">
                  Description
                </span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-[#cbd4c6] px-3 py-2 text-sm leading-6 outline-none focus:border-[#17251f]"
                  maxLength={400}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  value={form.description}
                />
              </label>
              <button
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
                disabled={pendingAction === "create" || !form.title.trim()}
                onClick={createRoom}
                type="button"
              >
                {pendingAction === "create" ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Create room
              </button>
            </div>
          </aside>

          <section className="grid content-start gap-4 md:grid-cols-2">
            {rooms.length === 0 ? (
              <div className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm md:col-span-2">
                <p className="text-sm font-semibold text-[#607265]">
                  No voice rooms yet
                </p>
                <p className="mt-2 text-sm leading-6 text-[#34443a]">
                  Start a room for a topic, language exchange, or low-pressure
                  hangout.
                </p>
              </div>
            ) : null}
            {rooms.map((room) => (
              <article
                className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm"
                key={room.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
                      {room.roomType === "private" ? (
                        <Lock size={15} />
                      ) : room.roomType === "scheduled" ? (
                        <CalendarDays size={15} />
                      ) : (
                        <Users size={15} />
                      )}
                      {toTitle(room.roomType)} room
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{room.title}</h2>
                  </div>
                  <span className="rounded-md bg-[#edf2e9] px-2 py-1 text-xs font-bold text-[#34443a]">
                    {room.participantCount}/{room.maxParticipants}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#34443a]">
                  {room.description ?? "A calm voice room for a focused chat."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {room.topic ? <Tag value={room.topic} /> : null}
                  {room.language ? <Tag value={room.language} /> : null}
                  {room.scheduledAt ? (
                    <Tag value={formatDate(room.scheduledAt)} />
                  ) : null}
                </div>
                {room.roomType === "private" && !room.isMember ? (
                  <input
                    className="mt-4 h-10 w-full rounded-md border border-[#cbd4c6] px-3 text-sm outline-none focus:border-[#17251f]"
                    onChange={(event) =>
                      setInviteCodes((current) => ({
                        ...current,
                        [room.id]: event.target.value,
                      }))
                    }
                    placeholder="Invite code"
                    value={inviteCodes[room.id] ?? ""}
                  />
                ) : null}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-3 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
                    disabled={pendingAction === "join"}
                    onClick={() => joinRoom(room)}
                    type="button"
                  >
                    {pendingAction === "join" ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <Mic size={16} />
                    )}
                    {room.isMember ? "Enter" : "Join"}
                  </button>
                  <Link
                    className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
                    href={`/voice/rooms/${room.id}`}
                  >
                    Details
                  </Link>
                </div>
              </article>
            ))}
          </section>
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

function getFailureMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const actionPayload = payload as ApiErrorPayload;
  const firstIssue = actionPayload.issues?.[0]?.message;

  return [actionPayload.error, firstIssue].filter(Boolean).join(" ") || fallback;
}
