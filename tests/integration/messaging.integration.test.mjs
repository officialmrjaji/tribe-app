import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("messaging integration contract", () => {
  it("keeps messaging member-scoped, permission-based, and rate limited", () => {
    const service = readFileSync("src/lib/messaging/service.ts", "utf8");
    const route = readFileSync(
      "src/app/api/conversations/[conversationId]/messages/route.ts",
      "utf8",
    );

    assert.match(service, /assertMutualSavePermission/);
    assert.match(service, /assertNotBlocked/);
    assert.match(service, /getConversationMembership/);
    assert.match(route, /assertRateLimit/);
    assert.match(route, /recordSpamSignal/);
  });
});
