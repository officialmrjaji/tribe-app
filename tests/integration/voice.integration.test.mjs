import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("voice integration contract", () => {
  it("keeps voice session creation rate-limited and analytics-aware", () => {
    const matchRoute = readFileSync("src/app/api/voice/match/route.ts", "utf8");
    const service = readFileSync("src/lib/voice/service.ts", "utf8");

    assert.match(matchRoute, /assertRateLimit/);
    assert.match(matchRoute, /voice_session_started/);
    assert.match(service, /5 \* 60 \* 1000/);
    assert.match(service, /reveal_profiles_after/);
  });

  it("keeps voice room chat server-owned, rate-limited, and realtime-aware", () => {
    const chatRoute = readFileSync(
      "src/app/api/voice/rooms/[roomId]/chat/route.ts",
      "utf8",
    );
    const reportRoute = readFileSync(
      "src/app/api/voice/rooms/[roomId]/chat/[messageId]/report/route.ts",
      "utf8",
    );
    const realtimeRoute = readFileSync(
      "src/app/api/realtime/events/route.ts",
      "utf8",
    );
    const migration = readFileSync(
      "supabase/migrations/20260715000000_voice_room_chat.sql",
      "utf8",
    );
    const service = readFileSync("src/lib/voice/service.ts", "utf8");

    assert.match(chatRoute, /getVoiceSessionContext/);
    assert.match(chatRoute, /assertRateLimit/);
    assert.match(chatRoute, /voice_room_chat_send/);
    assert.match(chatRoute, /recordSpamSignal/);
    assert.match(reportRoute, /reportVoiceRoomMessage/);
    assert.match(service, /assertCanUseRoomChat/);
    assert.match(service, /voice_room_message_reports/);
    assert.match(realtimeRoute, /voice_room_messages/);
    assert.match(realtimeRoute, /voice_chat/);
    assert.match(migration, /voice_room_messages/);
    assert.match(migration, /voice_room_message_reports/);
    assert.match(migration, /revoke all on public\.voice_room_messages/);
  });

  it("keeps Voice Rooms creatable and circular mini-room UX shell-mounted", () => {
    const navigationFrame = readFileSync(
      "src/components/navigation/navigation-frame.tsx",
      "utf8",
    );
    const provider = readFileSync(
      "src/components/voice/active-voice-room-provider.tsx",
      "utf8",
    );
    const roomClient = readFileSync(
      "src/app/voice/rooms/[roomId]/voice-room-client.tsx",
      "utf8",
    );
    const voiceHome = readFileSync("src/app/voice/voice-home-client.tsx", "utf8");

    assert.match(navigationFrame, /ActiveVoiceRoomProvider/);
    assert.match(provider, /chatUnreadCount/);
    assert.match(provider, /snapToEdge/);
    assert.match(provider, /onPointerMove/);
    assert.match(provider, /rounded-full/);
    assert.match(roomClient, /minimizeRoom/);
    assert.match(roomClient, /RoomChatDrawer/);
    assert.match(voiceHome, /Open Voice Room/);
    assert.doesNotMatch(voiceHome, /!form\.title\.trim\(\)/);
  });

  it("keeps random voice match copy simplified without changing reveal flow", () => {
    const sessionClient = readFileSync(
      "src/app/voice/match/[sessionId]/voice-session-client.tsx",
      "utf8",
    );

    assert.match(sessionClient, /Two minutes first, profiles reveal after\./);
    assert.match(sessionClient, /language preferences/);
    assert.match(sessionClient, /continueTalking/);
    assert.match(sessionClient, /revealProfiles/);
    assert.doesNotMatch(sessionClient, /Reveal rule/);
    assert.doesNotMatch(sessionClient, /The profile stays hidden/);
  });
});
