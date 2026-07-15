"use client";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  DoorOpen,
  Hand,
  Headphones,
  Info,
  LoaderCircle,
  Lock,
  MessageCircle,
  Mic,
  MicOff,
  MoreVertical,
  Radio,
  ShieldAlert,
  ShieldCheck,
  UserMinus,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeStorageImage } from "@/components/media/safe-storage-image";
import { useActiveVoiceRoom } from "@/components/voice/active-voice-room-provider";
import { VoiceIntroPlayer } from "@/components/voice/voice-intro-player";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";
import type {
  VoiceRoomChatMessage,
  VoiceRoomParticipantSummary,
  VoiceRoomSummary,
} from "@/lib/voice/service";

type VoiceRoomPayload = {
  error?: string;
  room?: VoiceRoomSummary;
};

type VoiceRoomChatPayload = {
  error?: string;
  message?: VoiceRoomChatMessage;
  messages?: VoiceRoomChatMessage[];
  pagination?: {
    hasMore: boolean;
    limit: number;
    nextCursor: string | null;
  };
};

type RoomAction =
  | "approve_speaker"
  | "cancel_raise_hand"
  | "demote_moderator"
  | "end_room"
  | "leave_room"
  | "lock_room"
  | "promote_moderator"
  | "raise_hand"
  | "reject_speaker"
  | "remove_participant"
  | "unlock_room";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function VoiceRoomClient({
  initialRoom,
}: {
  initialRoom: VoiceRoomSummary;
}) {
  const router = useRouter();
  const activeRoomState = useActiveVoiceRoom();
  const {
    activeRoom,
    chatUnreadCount,
    clearActiveRoom,
    clearChatUnread,
    isMinimized,
    minimizeRoom,
    registerActiveRoom,
    setActiveRoom,
    toggleMute: toggleActiveRoomMute,
  } = activeRoomState;
  const [room, setRoom] = useState(initialRoom);
  const [inviteCode, setInviteCode] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [selectedParticipant, setSelectedParticipant] =
    useState<VoiceRoomParticipantSummary | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<VoiceRoomChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatPendingId, setChatPendingId] = useState("");
  const [chatReportPendingId, setChatReportPendingId] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const viewerParticipant =
    room.participants.find(
      (participant) => participant.userId === room.viewerUserId,
    ) ?? null;
  const currentUserRaisedHand = Boolean(viewerParticipant?.handRaisedAt);
  const canModerate = room.isHost || room.viewerRole === "moderator";
  const isRoomEnded = room.status === "closed" || room.status === "cancelled";
  const isMuted = activeRoomState.isMuted;

  useEffect(() => {
    if (room.isMember && !isRoomEnded) {
      registerActiveRoom(room, {
        minimized: isMinimized,
      });
    }

    if (isRoomEnded || !room.isMember) {
      clearActiveRoom();
    }
  }, [clearActiveRoom, isMinimized, isRoomEnded, registerActiveRoom, room]);

  const refreshRoom = useCallback(async () => {
    try {
      const response = await fetch(`/api/voice/rooms/${room.id}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceRoomPayload
        | null;

      if (response.ok && payload?.room) {
        setRoom(payload.room);

        if (
          payload.room.isMember &&
          payload.room.status !== "closed" &&
          payload.room.status !== "cancelled"
        ) {
          setActiveRoom(payload.room);
        } else {
          clearActiveRoom();
        }
      }
    } catch {
      // Keep the current room snapshot. Realtime and fallback polling will retry.
    }
  }, [clearActiveRoom, room.id, setActiveRoom]);

  useRealtimeInvalidation({
    events: ["voice"],
    fallbackIntervalMs: 20_000,
    onInvalidate: () => {
      void refreshRoom();
    },
  });

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
      setMessage("Microphone is available.");
    } catch {
      setError("Microphone permission is needed for voice rooms.");
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleMute() {
    if (!isMuted) {
      toggleActiveRoomMute();
      setMessage("Muted.");
      return;
    }

    setPendingAction("mic");
    setError("");
    setMessage("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      stream.getTracks().forEach((track) => track.stop());
      toggleActiveRoomMute();
      setMessage("Microphone is available.");
    } catch {
      setError("Microphone permission is needed before unmuting.");
    } finally {
      setPendingAction(null);
    }
  }

  const loadRoomChat = useCallback(async () => {
    if (!room.isMember || isRoomEnded) {
      return;
    }

    setChatLoading(true);
    setChatError("");

    try {
      const response = await fetch(`/api/voice/rooms/${room.id}/chat`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceRoomChatPayload
        | null;

      if (!response.ok || !payload?.messages) {
        throw new Error(payload?.error ?? "Room chat could not load.");
      }

      setChatMessages(payload.messages);

      if (chatOpen) {
        clearChatUnread();
      }
    } catch (chatLoadError) {
      setChatError(
        chatLoadError instanceof Error
          ? chatLoadError.message
          : "Room chat could not load.",
      );
    } finally {
      setChatLoading(false);
    }
  }, [chatOpen, clearChatUnread, isRoomEnded, room.id, room.isMember]);

  useEffect(() => {
    if (chatOpen) {
      const timer = window.setTimeout(() => {
        void loadRoomChat();
      }, 0);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [chatOpen, loadRoomChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatMessages.length, chatOpen]);

  useRealtimeInvalidation({
    events: ["voice_chat"],
    fallbackIntervalMs: 60_000,
    onInvalidate: (event) => {
      if (event === "voice_chat" && chatOpen) {
        void loadRoomChat();
      }
    },
  });

  async function sendRoomChatMessage() {
    const body = chatDraft.trim();

    if (!body || chatPendingId) {
      return;
    }

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: VoiceRoomChatMessage = {
      body,
      createdAt: new Date().toISOString(),
      id: clientMessageId,
      isMine: true,
      sender: viewerParticipant ?? {
        avatarUrl: null,
        city: "",
        name: "You",
        profileId: "",
        userId: room.viewerUserId,
        voiceIntroDurationSeconds: null,
        voiceIntroUrl: null,
      },
      status: "sending",
    };

    setChatPendingId(clientMessageId);
    setChatError("");
    setChatDraft("");
    setChatMessages((current) => [...current, optimisticMessage]);

    try {
      const response = await fetch(`/api/voice/rooms/${room.id}/chat`, {
        body: JSON.stringify({ body, clientMessageId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceRoomChatPayload
        | null;

      if (!response.ok || !payload?.message) {
        throw new Error(payload?.error ?? "Message could not be sent.");
      }

      setChatMessages((current) =>
        current.map((message) =>
          message.id === clientMessageId ? payload.message! : message,
        ),
      );
    } catch (sendError) {
      setChatMessages((current) =>
        current.filter((message) => message.id !== clientMessageId),
      );
      setChatDraft(body);
      setChatError(
        sendError instanceof Error ? sendError.message : "Message could not be sent.",
      );
    } finally {
      setChatPendingId("");
    }
  }

  async function reportRoomChatMessage(messageId: string) {
    const reason = window.prompt(
      "Tell us briefly why this room message should be reviewed.",
      "Voice room safety concern",
    );

    if (!reason?.trim() || chatReportPendingId) {
      return;
    }

    setChatReportPendingId(messageId);
    setChatError("");

    try {
      const response = await fetch(
        `/api/voice/rooms/${room.id}/chat/${messageId}/report`,
        {
          body: JSON.stringify({ reason }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Room message could not be reported."),
        );
      }

      setMessage("Room message reported for review.");
    } catch (reportError) {
      setChatError(
        reportError instanceof Error
          ? reportError.message
          : "Room message could not be reported.",
      );
    } finally {
      setChatReportPendingId("");
    }
  }

  async function joinRoom() {
    if (activeRoom && activeRoom.id !== room.id) {
      setError("Leave your current voice room before joining another one.");
      return;
    }

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
      setActiveRoom(payload.room);
      setMessage("You joined the voice room.");
    } catch (joinError) {
      setError(
        joinError instanceof Error ? joinError.message : "Unable to join room.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function runRoomAction(action: RoomAction, targetUserId?: string) {
    if (
      action === "end_room" &&
      !window.confirm("End this voice room for everyone?")
    ) {
      return;
    }

    if (
      action === "remove_participant" &&
      !window.confirm("Remove this participant from the room?")
    ) {
      return;
    }

    if (
      action === "leave_room" &&
      !room.isHost &&
      !window.confirm("Leave this voice room?")
    ) {
      return;
    }

    setPendingAction(`${action}:${targetUserId ?? "self"}`);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/voice/rooms/${room.id}/actions`, {
        body: JSON.stringify({ action, targetUserId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceRoomPayload
        | null;

      if (!response.ok || !payload?.room) {
        throw new Error(payload?.error ?? "Unable to update voice room.");
      }

      setRoom(payload.room);

      if (action === "leave_room" || action === "end_room") {
        clearActiveRoom();
        setMessage(action === "end_room" ? "Room ended." : "You left the room.");
      } else {
        setActiveRoom(payload.room);
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update voice room.",
      );
    } finally {
      setPendingAction(null);
      setMoreOpen(false);
    }
  }

  async function reportParticipant(participant: VoiceRoomParticipantSummary) {
    setPendingAction(`report:${participant.userId}`);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/profile/report", {
        body: JSON.stringify({
          details: `Reported from voice room ${room.id}.`,
          profileId: participant.profileId,
          reason: "Voice room safety concern",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Participant could not be reported."),
        );
      }

      setMessage("Participant reported for review.");
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Participant could not be reported.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function blockParticipant(participant: VoiceRoomParticipantSummary) {
    if (!window.confirm("Block this member?")) {
      return;
    }

    setPendingAction(`block:${participant.userId}`);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/profile/block", {
        body: JSON.stringify({
          profileId: participant.profileId,
          reason: "Voice room safety action",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Participant could not be blocked."),
        );
      }

      setSelectedParticipant(null);
      setMessage("Participant blocked.");
    } catch (blockError) {
      setError(
        blockError instanceof Error
          ? blockError.message
          : "Participant could not be blocked.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Room link copied.");
    } catch {
      setError("Room link could not be copied.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 pb-64 pt-6 text-[#17201b] sm:px-6 lg:px-10 lg:pb-36">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 sm:flex-row sm:items-start sm:justify-between">
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
              {room.status === "open" ? "Live" : toTitle(room.status)}
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{room.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              {room.description ??
                "A voice-only space for a calm, personality-first conversation."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {room.isLocked ? <Tag value="Locked" /> : null}
            {room.topic ? <Tag value={room.topic} /> : null}
            {room.isHost ? <Tag value="Host" /> : null}
            {room.viewerRole === "moderator" ? <Tag value="Moderator" /> : null}
            {room.isMember ? <Tag value="Joined" /> : null}
            {room.isMember && !isRoomEnded ? (
              <button
                className="flex h-8 items-center justify-center gap-1 rounded-md border border-[#cbd4c6] bg-white px-2 text-xs font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
                onClick={() => {
                  minimizeRoom();
                  router.push("/");
                }}
                type="button"
              >
                <ChevronDown size={14} />
                Minimize
              </button>
            ) : null}
          </div>
        </header>

        {message ? <Notice message={message} tone="success" /> : null}
        {error ? <Notice message={error} tone="error" /> : null}

        {isRoomEnded ? (
          <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[#607265]">Room ended</p>
            <p className="mt-2 text-sm leading-6 text-[#34443a]">
              This voice room is closed. You can return to Voice Rooms to join
              another live room.
            </p>
          </section>
        ) : null}

        {!room.isMember && !isRoomEnded ? (
          <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#607265]">Join room</p>
            {room.roomType === "private" ? (
              <input
                className="mt-3 h-10 w-full rounded-md border border-[#cbd4c6] px-3 text-sm outline-none focus:border-[#17251f]"
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="Invite code"
                value={inviteCode}
              />
            ) : null}
            <button
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60 sm:w-auto"
              disabled={
                pendingAction === "join" ||
                room.isLocked ||
                room.participantCount >= room.maxParticipants
              }
              onClick={joinRoom}
              type="button"
            >
              {pendingAction === "join" ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Mic size={16} />
              )}
              {room.isLocked
                ? "Room locked"
                : room.participantCount >= room.maxParticipants
                  ? "Room full"
                  : "Join room"}
            </button>
          </section>
        ) : null}

        <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
                <Users size={16} />
                Participants
              </p>
              <p className="mt-1 text-sm text-[#34443a]">
                {room.participantCount}/{room.maxParticipants} in the room
              </p>
            </div>
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6] disabled:opacity-60"
              disabled={pendingAction === "mic"}
              onClick={checkMicrophone}
              type="button"
            >
              {pendingAction === "mic" ? (
                <LoaderCircle className="animate-spin" size={15} />
              ) : (
                <Headphones size={15} />
              )}
              Mic check
            </button>
          </div>

          {room.participants.length === 0 ? (
            <div className="mt-4 rounded-md bg-[#fbfaf4] p-4 text-sm text-[#34443a]">
              No one has joined yet.
            </div>
          ) : (
            <div
              className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              id="voice-participants"
            >
              {room.participants.map((participant) => (
                <ParticipantTile
                  canModerate={canModerate}
                  isCurrentUser={participant.userId === viewerParticipant?.userId}
                  isHostViewer={room.isHost}
                  key={participant.userId}
                  onAction={runRoomAction}
                  onSelect={setSelectedParticipant}
                  participant={participant}
                  pendingAction={pendingAction}
                />
              ))}
            </div>
          )}
        </section>

        {showRoomInfo ? (
          <section className="mt-4 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Info size={16} />
              Room information
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Stat label="Type" value={toTitle(room.roomType)} />
              <Stat label="Status" value={toTitle(room.status)} />
              <Stat
                label="Scheduled"
                value={room.scheduledAt ? formatDate(room.scheduledAt) : "Now"}
              />
            </div>
          </section>
        ) : null}
      </div>

      {selectedParticipant ? (
        <ProfileDrawer
          isSelf={selectedParticipant.userId === room.viewerUserId}
          onBlock={blockParticipant}
          onClose={() => setSelectedParticipant(null)}
          onReport={reportParticipant}
          participant={selectedParticipant}
          pendingAction={pendingAction}
        />
      ) : null}

      {chatOpen ? (
        <RoomChatDrawer
          chatDraft={chatDraft}
          chatEndRef={chatEndRef}
          error={chatError}
          isEnded={isRoomEnded}
          isMember={room.isMember}
          loading={chatLoading}
          messages={chatMessages}
          onChangeDraft={setChatDraft}
          onClose={() => {
            setChatOpen(false);
            clearChatUnread();
          }}
          onReportMessage={reportRoomChatMessage}
          onSend={sendRoomChatMessage}
          pending={Boolean(chatPendingId)}
          reportPendingId={chatReportPendingId}
          roomTitle={room.title}
        />
      ) : null}

      <div className="fixed inset-x-0 bottom-[76px] z-40 border-t border-[#d8ded1] bg-white/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(23,32,27,0.08)] backdrop-blur lg:bottom-0">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-2 sm:grid-cols-6">
          <ControlButton
            active={!isMuted}
            icon={isMuted ? MicOff : Mic}
            label={isMuted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          />
          <ControlButton
            icon={Users}
            label="Participants"
            onClick={() =>
              document.getElementById("voice-participants")?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              })
            }
          />
          <ControlButton
            active={chatOpen}
            badgeCount={chatUnreadCount}
            disabled={!room.isMember || isRoomEnded}
            icon={MessageCircle}
            label="Room Chat"
            onClick={() => {
              setChatOpen(true);
              clearChatUnread();
            }}
          />
          <ControlButton
            active={currentUserRaisedHand}
            disabled={!room.isMember || room.isHost || isRoomEnded}
            icon={Hand}
            label={currentUserRaisedHand ? "Lower Hand" : "Raise Hand"}
            loading={
              pendingAction ===
              `${currentUserRaisedHand ? "cancel_raise_hand" : "raise_hand"}:self`
            }
            onClick={() =>
              void runRoomAction(
                currentUserRaisedHand ? "cancel_raise_hand" : "raise_hand",
              )
            }
          />
          <div className="relative">
            <ControlButton
              active={moreOpen}
              icon={MoreVertical}
              label="More"
              onClick={() => setMoreOpen((current) => !current)}
            />
            {moreOpen ? (
              <div className="absolute bottom-14 right-0 min-w-56 rounded-md border border-[#d8ded1] bg-white p-1 shadow-lg">
                <MenuButton
                  icon={Info}
                  label={showRoomInfo ? "Hide room info" : "View room info"}
                  onClick={() => {
                    setShowRoomInfo((current) => !current);
                    setMoreOpen(false);
                  }}
                />
                <MenuButton icon={Check} label="Copy room link" onClick={copyRoomLink} />
                {room.isHost ? (
                  <>
                    <MenuButton
                      icon={room.isLocked ? X : Lock}
                      label={room.isLocked ? "Unlock room" : "Lock room"}
                      onClick={() =>
                        void runRoomAction(
                          room.isLocked ? "unlock_room" : "lock_room",
                        )
                      }
                    />
                    <MenuButton
                      danger
                      icon={DoorOpen}
                      label="End room"
                      onClick={() => void runRoomAction("end_room")}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <ControlButton
            danger
            icon={DoorOpen}
            label={room.isHost ? "End" : "Leave"}
            loading={
              pendingAction ===
              `${room.isHost ? "end_room" : "leave_room"}:self`
            }
            onClick={() =>
              void runRoomAction(room.isHost ? "end_room" : "leave_room")
            }
          />
        </div>
      </div>
    </main>
  );
}

function ParticipantTile({
  canModerate,
  isCurrentUser,
  isHostViewer,
  onAction,
  onSelect,
  participant,
  pendingAction,
}: {
  canModerate: boolean;
  isCurrentUser: boolean;
  isHostViewer: boolean;
  onAction: (action: RoomAction, targetUserId?: string) => void;
  onSelect: (participant: VoiceRoomParticipantSummary) => void;
  participant: VoiceRoomParticipantSummary;
  pendingAction: string | null;
}) {
  const canChangeParticipant =
    canModerate && !isCurrentUser && participant.role !== "host";

  return (
    <article
      className={cx(
        "rounded-lg border bg-[#fbfaf4] p-3 transition",
        participant.isSpeaker
          ? "border-[#176b57] shadow-sm ring-2 ring-[#176b57]/10"
          : "border-[#e2e6dc]",
        participant.handRaisedAt && "bg-[#fff9eb]",
      )}
    >
      <button
        aria-label={`View ${participant.name}'s profile`}
        className="flex w-full items-center gap-3 text-left"
        onClick={() => onSelect(participant)}
        type="button"
      >
        {participant.avatarUrl ? (
          <SafeStorageImage
            alt={`${participant.name} avatar`}
            className="h-14 w-14 rounded-full object-cover"
            height={56}
            src={participant.avatarUrl}
            width={56}
          />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#176b57] text-white">
            <UserRound size={20} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[#17201b]">
            {participant.name}
          </span>
          <span className="mt-1 block truncate text-xs text-[#607265]">
            {participant.city}
          </span>
          <span className="mt-2 flex flex-wrap gap-1">
            {participant.isHost ? <RoleBadge label="Host" /> : null}
            {!participant.isHost && participant.isModerator ? (
              <RoleBadge label="Moderator" />
            ) : null}
            {participant.isSpeaker ? <RoleBadge label="Speaker" /> : null}
            {participant.handRaisedAt ? <RoleBadge label="Hand raised" /> : null}
            {participant.isMuted ? <RoleBadge label="Muted" muted /> : null}
          </span>
        </span>
      </button>

      {canChangeParticipant ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {participant.handRaisedAt ? (
            <>
              <SmallAction
                icon={Check}
                label="Approve"
                loading={
                  pendingAction === `approve_speaker:${participant.userId}`
                }
                onClick={() => onAction("approve_speaker", participant.userId)}
              />
              <SmallAction
                icon={X}
                label="Reject"
                loading={pendingAction === `reject_speaker:${participant.userId}`}
                onClick={() => onAction("reject_speaker", participant.userId)}
              />
            </>
          ) : null}
          {isHostViewer ? (
            <SmallAction
              icon={ShieldCheck}
              label={participant.role === "moderator" ? "Demote" : "Moderate"}
              loading={
                pendingAction ===
                `${
                  participant.role === "moderator"
                    ? "demote_moderator"
                    : "promote_moderator"
                }:${participant.userId}`
              }
              onClick={() =>
                onAction(
                  participant.role === "moderator"
                    ? "demote_moderator"
                    : "promote_moderator",
                  participant.userId,
                )
              }
            />
          ) : null}
          <SmallAction
            danger
            icon={UserMinus}
            label="Remove"
            loading={pendingAction === `remove_participant:${participant.userId}`}
            onClick={() => onAction("remove_participant", participant.userId)}
          />
        </div>
      ) : null}
    </article>
  );
}

function ProfileDrawer({
  isSelf,
  onBlock,
  onClose,
  onReport,
  participant,
  pendingAction,
}: {
  isSelf: boolean;
  onBlock: (participant: VoiceRoomParticipantSummary) => void;
  onClose: () => void;
  onReport: (participant: VoiceRoomParticipantSummary) => void;
  participant: VoiceRoomParticipantSummary;
  pendingAction: string | null;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-[#17201b]/30 px-4 py-6 backdrop-blur-sm">
      <aside className="ml-auto flex h-full max-w-md flex-col rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {participant.avatarUrl ? (
              <SafeStorageImage
                alt={`${participant.name} avatar`}
                className="h-14 w-14 rounded-full object-cover"
                height={56}
                src={participant.avatarUrl}
                width={56}
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#176b57] text-white">
                <UserRound size={20} />
              </span>
            )}
            <div>
              <h2 className="text-lg font-semibold">{participant.name}</h2>
              <p className="text-sm text-[#607265]">{participant.city}</p>
            </div>
          </div>
          <button
            aria-label="Close participant profile"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#607265] transition hover:bg-[#eef7f1]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {participant.voiceIntroUrl ? (
          <div className="mt-4">
            <VoiceIntroPlayer
              durationSeconds={participant.voiceIntroDurationSeconds}
              label={`${participant.name} voice intro`}
              src={participant.voiceIntroUrl}
            />
          </div>
        ) : null}

        <div className="mt-5 grid gap-2">
          <Link
            className="flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
            href={`/profiles/${participant.profileId}`}
          >
            View full profile
          </Link>
          {!isSelf ? (
            <>
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6] disabled:opacity-60"
                disabled={pendingAction === `report:${participant.userId}`}
                onClick={() => onReport(participant)}
                type="button"
              >
                {pendingAction === `report:${participant.userId}` ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <ShieldAlert size={16} />
                )}
                Report
              </button>
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#ef8f7a] bg-white px-4 text-sm font-semibold text-[#8a3325] transition hover:bg-[#fff5f1] disabled:opacity-60"
                disabled={pendingAction === `block:${participant.userId}`}
                onClick={() => onBlock(participant)}
                type="button"
              >
                {pendingAction === `block:${participant.userId}` ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <ShieldAlert size={16} />
                )}
                Block
              </button>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function RoomChatDrawer({
  chatDraft,
  chatEndRef,
  error,
  isEnded,
  isMember,
  loading,
  messages,
  onChangeDraft,
  onClose,
  onReportMessage,
  onSend,
  pending,
  reportPendingId,
  roomTitle,
}: {
  chatDraft: string;
  chatEndRef: { current: HTMLDivElement | null };
  error: string;
  isEnded: boolean;
  isMember: boolean;
  loading: boolean;
  messages: VoiceRoomChatMessage[];
  onChangeDraft: (value: string) => void;
  onClose: () => void;
  onReportMessage: (messageId: string) => void;
  onSend: () => void;
  pending: boolean;
  reportPendingId: string;
  roomTitle: string;
}) {
  const canSend = isMember && !isEnded;

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-[#17201b]/30 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10 backdrop-blur-sm sm:items-center sm:justify-center">
      <section className="flex max-h-[84vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[#d8ded1] bg-white shadow-xl sm:rounded-lg">
        <header className="flex items-start justify-between gap-3 border-b border-[#d8ded1] px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[#607265]">
              Room Chat
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#17201b]">
              {roomTitle}
            </h2>
          </div>
          <button
            aria-label="Close room chat"
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#607265] transition hover:bg-[#eef7f1]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fbfaf4] px-4 py-3">
          {loading && messages.length === 0 ? (
            <p className="rounded-md border border-[#d8ded1] bg-white px-3 py-2 text-sm text-[#607265]">
              Loading room chat...
            </p>
          ) : null}

          {!loading && messages.length === 0 ? (
            <p className="rounded-md border border-[#d8ded1] bg-white px-3 py-2 text-sm text-[#607265]">
              No room messages yet. Keep it brief and kind.
            </p>
          ) : null}

          {messages.map((message) => (
            <article
              className={cx(
                "flex items-start gap-2",
                message.isMine && "flex-row-reverse",
              )}
              key={message.id}
            >
              {message.sender.avatarUrl ? (
                <SafeStorageImage
                  alt={`${message.sender.name} avatar`}
                  className="h-8 w-8 rounded-full object-cover"
                  height={32}
                  src={message.sender.avatarUrl}
                  width={32}
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#176b57] text-white">
                  <UserRound size={14} />
                </span>
              )}
              <div
                className={cx(
                  "max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm",
                  message.isMine
                    ? "bg-[#176b57] text-white"
                    : "border border-[#d8ded1] bg-white text-[#17201b]",
                  message.status === "sending" && "opacity-70",
                )}
              >
                <p className="text-xs font-semibold opacity-75">
                  {message.isMine ? "You" : message.sender.name} /{" "}
                  {formatCompactTime(message.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap leading-5">
                  {message.body}
                </p>
                {!message.isMine && message.status !== "sending" ? (
                  <button
                    className="mt-2 text-xs font-semibold opacity-70 transition hover:opacity-100 disabled:opacity-40"
                    disabled={reportPendingId === message.id}
                    onClick={() => onReportMessage(message.id)}
                    type="button"
                  >
                    {reportPendingId === message.id ? "Reporting..." : "Report"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          <div ref={chatEndRef} />
        </div>

        {error ? (
          <p className="border-t border-[#f1c4b8] bg-[#fff5f1] px-4 py-2 text-sm font-semibold text-[#8a3325]">
            {error}
          </p>
        ) : null}

        <form
          className="border-t border-[#d8ded1] bg-white p-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
        >
          {!canSend ? (
            <p className="rounded-md border border-[#d8ded1] bg-[#fbfaf4] px-3 py-2 text-sm text-[#607265]">
              Room chat is available only while you are in a live room.
            </p>
          ) : (
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="voice-room-chat-message">
                Message room chat
              </label>
              <textarea
                className="min-h-11 flex-1 resize-none rounded-md border border-[#c9ddd3] px-3 py-2 text-sm outline-none transition focus:border-[#176b57] focus:ring-2 focus:ring-[#176b57]/15"
                id="voice-room-chat-message"
                maxLength={500}
                onChange={(event) => onChangeDraft(event.target.value)}
                placeholder="Message the room"
                value={chatDraft}
              />
              <button
                className="flex h-11 min-w-20 items-center justify-center gap-2 rounded-md bg-[#176b57] px-3 text-sm font-semibold text-white transition hover:bg-[#125744] disabled:opacity-60"
                disabled={pending || !chatDraft.trim()}
                type="submit"
              >
                {pending ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : null}
                Send
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}

function ControlButton({
  active = false,
  badgeCount = 0,
  danger = false,
  disabled = false,
  icon: Icon,
  label,
  loading = false,
  onClick,
  title,
}: {
  active?: boolean;
  badgeCount?: number;
  danger?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  loading?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      aria-label={label}
      className={cx(
        "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "border-[#176b57] bg-[#e4f4ec] text-[#176b57]"
          : danger
            ? "border-[#ef8f7a] bg-white text-[#8a3325] hover:bg-[#fff5f1]"
            : "border-[#d8ded1] bg-white text-[#34443a] hover:bg-[#f3f0e6]",
      )}
      disabled={disabled || loading}
      onClick={onClick}
      title={title ?? label}
      type="button"
    >
      <span className="relative">
        {loading ? (
          <LoaderCircle className="animate-spin" size={18} />
        ) : (
          <Icon size={18} />
        )}
        {badgeCount > 0 ? (
          <span className="absolute -right-2 -top-2 rounded-full bg-[#f6c66f] px-1 text-[10px] leading-4 text-[#17201b]">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

function MenuButton({
  danger = false,
  icon: Icon,
  label,
  onClick,
}: {
  danger?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cx(
        "flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold transition",
        danger
          ? "text-[#8a3325] hover:bg-[#fff5f1]"
          : "text-[#34443a] hover:bg-[#eef7f1]",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function SmallAction({
  danger = false,
  icon: Icon,
  label,
  loading = false,
  onClick,
}: {
  danger?: boolean;
  icon: LucideIcon;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cx(
        "inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold transition disabled:opacity-60",
        danger
          ? "border border-[#ef8f7a] text-[#8a3325] hover:bg-[#fff5f1]"
          : "border border-[#cbd4c6] text-[#34443a] hover:bg-[#f3f0e6]",
      )}
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      {loading ? <LoaderCircle className="animate-spin" size={13} /> : <Icon size={13} />}
      {label}
    </button>
  );
}

function RoleBadge({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={cx(
        "rounded-md px-2 py-0.5 text-[11px] font-semibold",
        muted ? "bg-[#f4e9e2] text-[#8a3325]" : "bg-[#e4f4ec] text-[#176b57]",
      )}
    >
      {label}
    </span>
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
      role={tone === "error" ? "alert" : "status"}
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

function formatCompactTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "now";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getFailureMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  return (payload as { error?: string }).error ?? fallback;
}
