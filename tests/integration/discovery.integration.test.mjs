import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("discovery integration contract", () => {
  it("keeps production eligibility gates before recommendations", () => {
    const service = readFileSync("src/lib/discovery/service.ts", "utf8");

    assert.match(service, /minimumBasicProfileCompletion/);
    assert.match(service, /minimumDiscoveryPhotoCount/);
    assert.match(service, /profile\.discoverable/);
    assert.match(service, /profile\.visibility !== "private"/);
    assert.match(service, /trackAnalyticsEvent/);
  });
});
