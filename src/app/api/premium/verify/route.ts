import { NextResponse } from "next/server";
import { z } from "zod";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { disabledFeatureResponse } from "@/lib/feature-response";

const verifySchema = z.object({
  reference: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    if (!isFeatureEnabled("premium") || !isFeatureEnabled("payments")) {
      return disabledFeatureResponse("premium");
    }

    const payload = verifySchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Payment reference is required.",
          issues: payload.error.issues,
        },
        { status: 400 },
      );
    }

    const { verifyPremiumPurchaseForUser } = await import(
      "@/lib/premium/service"
    );
    const result = await verifyPremiumPurchaseForUser({
      ownedProfile: session.ownedProfile,
      reference: payload.data.reference,
    });
    await trackAnalyticsEvent({
      eventType: "premium_conversion",
      ownedProfile: session.ownedProfile,
      properties: {
        planCode: result.plan.code,
        productType: result.plan.productType,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    const status = getServiceErrorStatus(error);

    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Premium error." },
        { status },
      );
    }

    return NextResponse.json(
      { error: "Unable to verify Tribe Premium payment." },
      { status: 500 },
    );
  }
}

function getServiceErrorStatus(error: unknown) {
  return error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : null;
}
