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
});
