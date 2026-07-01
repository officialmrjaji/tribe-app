import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("Square integration contract", () => {
  it("keeps Square posting safe and observable", () => {
    const postsRoute = readFileSync("src/app/api/square/posts/route.ts", "utf8");
    const service = readFileSync("src/lib/square/service.ts", "utf8");

    assert.match(postsRoute, /assertRateLimit/);
    assert.match(postsRoute, /recordSpamSignal/);
    assert.match(postsRoute, /square_post_created/);
    assert.match(service, /assertAnonymousPostAllowed/);
    assert.match(service, /reportSquarePost/);
  });
});
