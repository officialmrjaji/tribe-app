"use client";

import {
  DoorOpen,
  Maximize2,
  Mic,
  MicOff,
  MoreVertical,
  PhoneOff,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { SafeStorageImage } from "@/components/media/safe-storage-image";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";
import type { VoiceRoomSummary } from "@/lib/voice/service";

type VoiceRoomPayload = {
  error?: string;
  room?: VoiceRoomSummary;
};

type WidgetPosition = {
  x: number;
  y: number;
};

type ActiveVoiceRoomContextValue = {
  activeRoom: VoiceRoomSummary | null;
  activeRoomId: string | null;
  clearActiveRoom: () => void;
  isMinimized: boolean;
  isMuted: boolean;
  minimizeRoom: () => void;
  registerActiveRoom: (
    room: VoiceRoomSummary,
    options?: { minimized?: boolean },
  ) => void;
  setActiveRoom: (room: VoiceRoomSummary) => void;
  toggleMute: () => void;
};

const activeRoomIdKey = "tribe.activeVoiceRoomId";
const activeRoomMinimizedKey = "tribe.activeVoiceRoomMinimized";
const activeRoomMutedKey = "tribe.activeVoiceRoomMuted";
const activeRoomPositionKey = "tribe.activeVoiceRoomPosition";

const widgetSize = 68;
const edgeGap = 14;
const desktopEdgeGap = 24;
const mobileBottomReserve = 118;
const desktopBottomReserve = 32;

const ActiveVoiceRoomContext =
  createContext<ActiveVoiceRoomContextValue | null>(null);

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function ActiveVoiceRoomProvider({ children }: { children: ReactNode }) {
  const [activeRoom, setActiveRoomState] = useState<VoiceRoomSummary | null>(
    null,
  );
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(activeRoomIdKey),
  );
  const [isMinimized, setIsMinimized] = useState(
    () =>
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(activeRoomMinimizedKey) === "true",
  );
  const [isMuted, setIsMuted] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.sessionStorage.getItem(activeRoomMutedKey) !== "false",
  );

  const clearActiveRoom = useCallback(() => {
    setActiveRoomState(null);
    setActiveRoomId(null);
    setIsMinimized(false);

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(activeRoomIdKey);
      window.sessionStorage.removeItem(activeRoomMinimizedKey);
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
      // Keep the last snapshot. Realtime and fallback polling retry.
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

  const registerActiveRoom = useCallback(
    (room: VoiceRoomSummary, options: { minimized?: boolean } = {}) => {
      setActiveRoomState(room);
      setActiveRoomId(room.id);
      setIsMinimized(Boolean(options.minimized));

      window.sessionStorage.setItem(activeRoomIdKey, room.id);
      window.sessionStorage.setItem(
        activeRoomMinimizedKey,
        String(Boolean(options.minimized)),
      );
    },
    [],
  );

  const setActiveRoom = useCallback((room: VoiceRoomSummary) => {
    setActiveRoomState(room);
    setActiveRoomId(room.id);
    window.sessionStorage.setItem(activeRoomIdKey, room.id);
  }, []);

  const minimizeRoom = useCallback(() => {
    setIsMinimized(true);
    window.sessionStorage.setItem(activeRoomMinimizedKey, "true");
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      window.sessionStorage.setItem(activeRoomMutedKey, String(next));
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      activeRoom,
      activeRoomId,
      clearActiveRoom,
      isMinimized,
      isMuted,
      minimizeRoom,
      registerActiveRoom,
      setActiveRoom,
      toggleMute,
    }),
    [
      activeRoom,
      activeRoomId,
      clearActiveRoom,
      isMinimized,
      isMuted,
      minimizeRoom,
      registerActiveRoom,
      setActiveRoom,
      toggleMute,
    ],
  );

  return (
    <ActiveVoiceRoomContext.Provider value={contextValue}>
      {children}
      {activeRoom && isMinimized ? (
        <MiniVoiceRoomWidget
          clearActiveRoom={clearActiveRoom}
          isMuted={isMuted}
          room={activeRoom}
          setActiveRoom={setActiveRoom}
          setMinimized={setIsMinimized}
          toggleMute={toggleMute}
        />
      ) : null}
    </ActiveVoiceRoomContext.Provider>
  );
}

export function useActiveVoiceRoom() {
  const context = useContext(ActiveVoiceRoomContext);

  if (!context) {
    throw new Error("useActiveVoiceRoom must be used inside ActiveVoiceRoomProvider");
  }

  return context;
}

function MiniVoiceRoomWidget({
  clearActiveRoom,
  isMuted,
  room,
  setActiveRoom,
  setMinimized,
  toggleMute,
}: {
  clearActiveRoom: () => void;
  isMuted: boolean;
  room: VoiceRoomSummary;
  setActiveRoom: (room: VoiceRoomSummary) => void;
  setMinimized: (value: boolean) => void;
  toggleMute: () => void;
}) {
  const router = useRouter();
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    moved: false,
    originX: 0,
    originY: 0,
    pointerId: 0,
    startX: 0,
    startY: 0,
  });
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [position, setPosition] = useState<WidgetPosition | null>(() =>
    typeof window === "undefined" ? null : readStoredPosition() ?? defaultPosition(),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState("");

  const avatarProfile =
    room.participants.find((participant) => participant.speakingSince) ??
    room.participants.find((participant) => participant.isHost) ??
    room.host;
  const left = position?.x ?? 0;
  const top = position?.y ?? 0;
  const menuShouldOpenLeft =
    typeof window !== "undefined" && left > window.innerWidth / 2;

  useEffect(() => {
    const placeWidget = () => {
      setPosition((current) => {
        if (current) {
          return clampPosition(current);
        }

        return defaultPosition();
      });
    };

    placeWidget();
    window.addEventListener("resize", placeWidget);

    return () => window.removeEventListener("resize", placeWidget);
  }, []);

  function restoreRoom() {
    setMinimized(false);
    window.sessionStorage.setItem(activeRoomMinimizedKey, "false");
    router.push(`/voice/rooms/${room.id}`);
  }

  async function runExitAction() {
    if (pendingAction) {
      return;
    }

    const action = room.isHost ? "end_room" : "leave_room";
    const confirmed = window.confirm(
      room.isHost ? "End this voice room for everyone?" : "Leave this voice room?",
    );

    if (!confirmed) {
      return;
    }

    setPendingAction(action);

    try {
      const response = await fetch(`/api/voice/rooms/${room.id}/actions`, {
        body: JSON.stringify({ action }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | VoiceRoomPayload
        | null;

      if (response.ok && payload?.room) {
        setActiveRoom(payload.room);
      }

      clearActiveRoom();
    } finally {
      setPendingAction("");
      setMenuOpen(false);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    dragRef.current = {
      moved: false,
      originX: event.clientX,
      originY: event.clientY,
      pointerId: event.pointerId,
      startX: left,
      startY: top,
    };
    longPressTriggeredRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setMenuOpen(true);
    }, 520);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;

    if (drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.originX;
    const deltaY = event.clientY - drag.originY;

    if (Math.abs(deltaX) + Math.abs(deltaY) > 8) {
      drag.moved = true;

      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    if (drag.moved) {
      setPosition(
        clampPosition({
          x: drag.startX + deltaX,
          y: drag.startY + deltaY,
        }),
      );
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;

    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (drag.pointerId === event.pointerId && drag.moved) {
      const snapped = snapToEdge({
        x: drag.startX + event.clientX - drag.originX,
        y: drag.startY + event.clientY - drag.originY,
      });
      setPosition(snapped);
      storePosition(snapped);
      return;
    }

    if (longPressTriggeredRef.current) {
      return;
    }

    restoreRoom();
  }

  return (
    <div
      className="fixed z-[70]"
      ref={widgetRef}
      style={{
        left,
        top,
      }}
    >
      <button
        aria-label={`Restore ${room.title}`}
        className={cx(
          "group relative flex h-[68px] w-[68px] touch-none items-center justify-center rounded-full border border-white/70 bg-[#176b57] text-white shadow-[0_14px_36px_rgba(23,32,27,0.24)] outline-none transition focus-visible:ring-4 focus-visible:ring-[#176b57]/25 motion-safe:active:scale-95",
          isMuted && "bg-[#17251f]",
        )}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuOpen(true);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="Restore voice room"
        type="button"
      >
        {avatarProfile?.avatarUrl ? (
          <SafeStorageImage
            alt=""
            className="h-full w-full rounded-full object-cover"
            height={68}
            src={avatarProfile.avatarUrl}
            width={68}
          />
        ) : (
          <Radio size={26} />
        )}
        <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-white bg-[#2fbd73] shadow-sm" />
        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#fbfaf4] text-[#17251f] shadow-sm">
          {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
        </span>
        <span className="sr-only">
          {isMuted ? "Microphone muted" : "Microphone unmuted"}
        </span>
      </button>

      <button
        aria-label="Open voice room quick actions"
        className="absolute -left-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-[#d8ded1] bg-white text-[#34443a] shadow-sm transition hover:bg-[#f3f0e6]"
        onClick={() => setMenuOpen((current) => !current)}
        type="button"
      >
        <MoreVertical size={14} />
      </button>

      {menuOpen ? (
        <div
          className={cx(
            "absolute top-0 w-48 rounded-lg border border-[#d8ded1] bg-white p-2 text-[#17201b] shadow-xl",
            menuShouldOpenLeft ? "right-20" : "left-20",
          )}
        >
          <p className="truncate px-2 pb-1 text-xs font-semibold uppercase text-[#607265]">
            {room.title}
          </p>
          <QuickAction icon={Maximize2} label="Restore" onClick={restoreRoom} />
          <QuickAction
            icon={isMuted ? Mic : MicOff}
            label={isMuted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          />
          <QuickAction
            danger
            icon={room.isHost ? PhoneOff : DoorOpen}
            label={pendingAction ? "Working..." : room.isHost ? "End Room" : "Leave Room"}
            onClick={() => void runExitAction()}
          />
        </div>
      ) : null}
    </div>
  );
}

function QuickAction({
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
        "flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold transition",
        danger
          ? "text-[#8a3325] hover:bg-[#fff5f1]"
          : "text-[#34443a] hover:bg-[#f3f0e6]",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function readStoredPosition() {
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(activeRoomPositionKey) ?? "",
    ) as WidgetPosition;

    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return clampPosition(parsed);
    }
  } catch {
    // Ignore malformed session storage values.
  }

  return null;
}

function storePosition(position: WidgetPosition) {
  window.sessionStorage.setItem(activeRoomPositionKey, JSON.stringify(position));
}

function defaultPosition(): WidgetPosition {
  const gap = window.innerWidth >= 1024 ? desktopEdgeGap : edgeGap;
  return clampPosition({
    x: window.innerWidth - widgetSize - gap,
    y:
      window.innerHeight -
      widgetSize -
      (window.innerWidth >= 1024 ? desktopBottomReserve : mobileBottomReserve),
  });
}

function snapToEdge(position: WidgetPosition): WidgetPosition {
  const gap = window.innerWidth >= 1024 ? desktopEdgeGap : edgeGap;
  const nextX =
    position.x + widgetSize / 2 > window.innerWidth / 2
      ? window.innerWidth - widgetSize - gap
      : gap;

  return clampPosition({
    x: nextX,
    y: position.y,
  });
}

function clampPosition(position: WidgetPosition): WidgetPosition {
  const gap = window.innerWidth >= 1024 ? desktopEdgeGap : edgeGap;
  const bottomReserve =
    window.innerWidth >= 1024 ? desktopBottomReserve : mobileBottomReserve;
  const minY = gap + 56;
  const maxY = Math.max(
    minY,
    window.innerHeight - widgetSize - bottomReserve,
  );

  return {
    x: Math.min(Math.max(position.x, gap), window.innerWidth - widgetSize - gap),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}
