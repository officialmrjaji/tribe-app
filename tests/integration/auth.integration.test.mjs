import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("authentication integration contract", () => {
  it("protects signed-in app and API surfaces through Clerk middleware", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");

    assert.match(proxy, /clerkMiddleware/);
    assert.match(proxy, /"\/admin\(\.\*\)"/);
    assert.match(proxy, /"\/api\/admin\(\.\*\)"/);
    assert.match(proxy, /"\/api\/profile\(\.\*\)"/);
    assert.match(proxy, /"\/api\/discover\(\.\*\)"/);
  });
});
