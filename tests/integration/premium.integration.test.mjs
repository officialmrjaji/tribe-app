import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("premium integration contract", () => {
  it("keeps Paystack verification server-side and tracks conversions", () => {
    const verifyRoute = readFileSync("src/app/api/premium/verify/route.ts", "utf8");
    const webhookRoute = readFileSync(
      "src/app/api/premium/webhook/route.ts",
      "utf8",
    );

    assert.match(webhookRoute, /verifyPaystackWebhookSignature/);
    assert.match(verifyRoute, /verifyPremiumPurchaseForUser/);
    assert.match(verifyRoute, /premium_conversion/);
  });
});
