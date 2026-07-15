"use client";

import {
  DoorOpen,
  Grip,
  LoaderCircle,
  Maximize2,
  Mic,
  MicOff,
  MoreVertical,
  Radio,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";
import type { VoiceRoomSummary } from "@/lib/voice/service";

type VoiceRoomPayload = {
  error?: string;
  room?: VoiceRoomSummary;
};

type ActiveVoiceRoomContextValue = {
  activeRoom: VoiceRoomSummary | null;
  chatUnreadCount: number;
  clearActiveRoom: () => void;
  clearChatUnread: () => void;
  isMinimized: boolean;
  isMuted: boolean;
  minimizeRoom: () => void;
  registerActiveRoom: (room: VoiceRoomSummary, options?: { minimized?: boolean }) => void;
  setActiveRoom: (room: VoiceRoomSummary) => void;
  setChatUnreadCount: (count: number) => void;
  toggleMute: () => void;
};

const activeRoomIdKey = "tribe.activeVoiceRoomId";
const activeRoomMinimizedKey = "tribe.activeVoiceRoomMinimized";
const activeRoomMutedKey = "tribe.activeVoiceRoomMuted";
const activeRoomPositionKey = "tribe.activeVoiceRoomPosition";

const ActiveVoiceRoomContext =
  createContext<ActiveVoiceRoomContextValue | null>(null);

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function ActiveVoiceRoomProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [activeRoom, setActiveRoomState] = useState<VoiceRoomSummary | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(activeRoomIdKey),
  );
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(activeRoomMinimizedKey) === "true",
  );
  const [isMuted, setIsMuted] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.localStorage.getItem(activeRoomMutedKey) !== "false",
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [position, setPosition] = useState<"left" | "right">(() => {
    if (typeof window === "undefined") {
      return "right";
    }

    const storedPosition = window.localStorage.getItem(activeRoomPositionKey);

    return storedPosition === "left" ? "left" : "right";
  });
  const [menuOpen, setMenuOpen] = useState(false);

  const clearActiveRoom = useCallback(() => {
    setActiveRoomState(null);
    setActiveRoomId(null);
    setChatUnreadCount(0);
    setIsMinimized(false);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(activeRoomIdKey);
      window.localStorage.removeItem(activeRoomMinimizedKey);
    }
  }, []);

  const loadActiveRoom = useCallback(async () => {
    if (!activeRoomId) {
      return;
    }

    try {
      const response = await fetch(`/api/voice/rooms/${activeRoomId}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceRoomPayload
        | null;

      if (!response.ok || !payload?.room) {
        clearActiveRoom();
        return;
      }

      if (
        !payload.room.isMember ||
        payload.room.status === "closed" ||
        payload.room.status === "cancelled"
      ) {
        clearActiveRoom();
        return;
      }

      setActiveRoomState(payload.room);
    } catch {
      // Keep the current snapshot; fallback polling will retry.
    }
  }, [activeRoomId, clearActiveRoom]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadActiveRoom();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadActiveRoom]);

  useRealtimeInvalidation({
    events: ["voice"],
    fallbackIntervalMs: 20_000,
    onInvalidate: () => {
      void loadActiveRoom();
    },
  });

  useRealtimeInvalidation({
    events: ["voice_chat"],
    fallbackIntervalMs: 60_000,
    onInvalidate: (event) => {
      if (event === "voice_chat" && activeRoomId) {
        setChatUnreadCount((count) => Math.min(99, count + 1));
      }
    },
  });

  useEffect(() => {
    const handleSignOut = () => {
      if (!activeRoomId || pendingAction) {
        return;
      }

      void fetch(`/api/voice/rooms/${activeRoomId}/actions`, {
        body: JSON.stringify({ action: "leave_room" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).finally(clearActiveRoom);
    };

    window.addEventListener("tribe:sign-out", handleSignOut);

    return () => window.removeEventListener("tribe:sign-out", handleSignOut);
  }, [activeRoomId, clearActiveRoom, pendingAction]);

  const registerActiveRoom = useCallback(
    (room: VoiceRoomSummary, options: { minimized?: boolean } = {}) => {
      setActiveRoomState(room);
      setActiveRoomId(room.id);
      setIsMinimized(Boolean(options.minimized));

      window.localStorage.setItem(activeRoomIdKey, room.id);
      window.localStorage.setItem(
        activeRoomMinimizedKey,
        String(Boolean(options.minimized)),
      );
    },
    [],
  );

  const setActiveRoom = useCallback((room: VoiceRoomSummary) => {
    setActiveRoomState(room);
    setActiveRoomId(room.id);
    window.localStorage.setItem(activeRoomIdKey, room.id);
  }, []);

  const minimizeRoom = useCallback(() => {
    setIsMinimized(true);
    window.localStorage.setItem(activeRoomMinimizedKey, "true");
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      window.localStorage.setItem(activeRoomMutedKey, String(next));
      return next;
    });
  }, []);

  const clearChatUnread = useCallback(() => {
    setChatUnreadCount(0);
  }, []);

  const moveWidget = useCallback(() => {
    setPosition((current) => {
      const next = current === "right" ? "left" : "right";
      window.localStorage.setItem(activeRoomPositionKey, next);
      return next;
    });
  }, []);

  const leaveFromWidget = useCallback(async () => {
    if (!activeRoom || pendingAction) {
      return;
    }

    const action = activeRoom.isHost ? "end_room" : "leave_room";
    const confirmed = window.confirm(
      activeRoom.isHost
        ? "End this voice room for everyone?"
        : "Leave this voice room?",
    );

    if (!confirmed) {
      return;
    }

    setPendingAction(action);

    try {
      await fetch(`/api/voice/rooms/${activeRoom.id}/actions`, {
        body: JSON.stringify({ action }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } finally {
      setPendingAction(null);
      clearActiveRoom();
    }
  }, [activeRoom, clearActiveRoom, pendingAction]);

  const value = useMemo(
    () => ({
      activeRoom,
      chatUnreadCount,
      clearActiveRoom,
      clearChatUnread,
      isMinimized,
      isMuted,
      minimizeRoom,
      registerActiveRoom,
      setActiveRoom,
      setChatUnreadCount,
      toggleMute,
    }),
    [
      activeRoom,
      chatUnreadCount,
      clearActiveRoom,
      clearChatUnread,
      isMinimized,
      isMuted,
      minimizeRoom,
      registerActiveRoom,
      setActiveRoom,
      toggleMute,
    ],
  );

  return (
    <ActiveVoiceRoomContext.Provider value={value}>
      {children}
      {activeRoom && isMinimized ? (
        <div
          className={cx(
            "fixed bottom-[92px] z-[60] w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-[#c9ddd3] bg-white p-3 text-[#17201b] shadow-[0_16px_45px_rgba(23,32,27,0.18)] lg:bottom-5",
            position === "right" ? "right-4" : "left-4",
          )}
        >
          <div className="flex items-center gap-3">
            <button
              aria-label="Restore voice room"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#176b57] text-white"
              onClick={() => router.push(`/voice/rooms/${activeRoom.id}`)}
              type="button"
            >
              <Radio size={19} />
            </button>
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => router.push(`/voice/rooms/${activeRoom.id}`)}
              type="button"
            >
              <span className="block truncate text-sm font-semibold">
                {activeRoom.title}
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-[#477060]">
                Live
                {chatUnreadCount > 0 ? (
                  <span className="rounded-full bg-[#f6c66f] px-1.5 py-0.5 text-[10px] text-[#17201b]">
                    {chatUnreadCount > 9 ? "9+" : chatUnreadCount} chat
                  </span>
                ) : null}
              </span>
            </button>
            <button
              aria-label={isMuted ? "Unmute mini room" : "Mute mini room"}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[#d8ded1] text-[#34443a] transition hover:bg-[#f3f0e6]"
              onClick={toggleMute}
              type="button"
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <div className="relative">
              <button
                aria-expanded={menuOpen}
                aria-label="Mini room actions"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-[#d8ded1] text-[#34443a] transition hover:bg-[#f3f0e6]"
                onClick={() => setMenuOpen((open) => !open)}
                type="button"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen ? (
                <div className="absolute bottom-12 right-0 min-w-44 rounded-md border border-[#d8ded1] bg-white p-1 shadow-lg">
                  <MiniMenuButton
                    icon={Maximize2}
                    label="Open room"
                    onClick={() => router.push(`/voice/rooms/${activeRoom.id}`)}
                  />
                  <MiniMenuButton
                    icon={Grip}
                    label={position === "right" ? "Move left" : "Move right"}
                    onClick={moveWidget}
                  />
                  <MiniMenuButton
                    danger
                    icon={activeRoom.isHost ? X : DoorOpen}
                    label={activeRoom.isHost ? "End room" : "Leave room"}
                    loading={Boolean(pendingAction)}
                    onClick={leaveFromWidget}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </ActiveVoiceRoomContext.Provider>
  );
}

export function useActiveVoiceRoom() {
  const context = useContext(ActiveVoiceRoomContext);

  if (!context) {
    throw new Error("useActiveVoiceRoom must be used inside ActiveVoiceRoomProvider.");
  }

  return context;
}

function MiniMenuButton({
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
        "flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:opacity-60",
        danger ? "text-[#8a3325] hover:bg-[#fff5f1]" : "hover:bg-[#eef7f1]",
      )}
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      {loading ? <LoaderCircle className="animate-spin" size={15} /> : <Icon size={15} />}
      {label}
    </button>
  );
}
