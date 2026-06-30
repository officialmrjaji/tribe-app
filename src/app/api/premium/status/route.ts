import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  boostPlanOptions,
  getPremiumStatus,
  premiumPlanOptions,
} from "@/lib/premium/service";

export async function GET() {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const status = await getPremiumStatus(session.ownedProfile);

    return NextResponse.json({
      boostPlans: boostPlanOptions,
      premiumPlans: premiumPlanOptions,
      status,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Tribe Premium status.",
      },
      { status: 500 },
    );
  }
}
