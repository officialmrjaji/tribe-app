import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { restorePremiumPurchases } from "@/lib/premium/service";

export async function POST() {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const result = await restorePremiumPurchases(session.ownedProfile);

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to restore Tribe Premium purchases.",
      },
      { status: 500 },
    );
  }
}
