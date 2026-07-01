import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("admin integration contract", () => {
  it("keeps admin access explicit and adds moderation operations", () => {
    const service = readFileSync("src/lib/admin/service.ts", "utf8");
    const page = readFileSync("src/app/admin/page.tsx", "utf8");

    assert.match(service, /TRIBE_ADMIN_CLERK_USER_IDS/);
    assert.match(service, /admin_roles/);
    assert.match(service, /performModerationAction/);
    assert.match(page, /Reports queue/);
    assert.match(page, /Feature flags/);
  });
});
