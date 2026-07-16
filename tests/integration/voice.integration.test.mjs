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

  it("keeps Voice Rooms creatable and mini-room UX shell-mounted", () => {
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
    assert.match(provider, /sessionStorage/);
    assert.match(provider, /snapToEdge/);
    assert.match(provider, /onPointerMove/);
    assert.match(roomClient, /minimizeRoom/);
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
