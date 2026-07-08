import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { disabledFeatureResponse } from "@/lib/feature-response";

const checkoutSchema = z.object({
  planCode: z.string().min(1),
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

    const payload = checkoutSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Invalid checkout payload.",
          issues: payload.error.issues,
        },
        { status: 400 },
      );
    }

    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const { initializePremiumCheckout } = await import(
      "@/lib/premium/service"
    );
    const checkout = await initializePremiumCheckout({
      origin,
      ownedProfile: session.ownedProfile,
      planCode: payload.data.planCode,
    });

    return NextResponse.json(checkout, { status: 201 });
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
      { error: "Unable to start Tribe Premium checkout." },
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
