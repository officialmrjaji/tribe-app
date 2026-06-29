import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getDiscoveryRecommendations } from "@/lib/discovery/service";
import { getProfileQuality } from "@/lib/profile/service";

function jsonError(error: unknown) {
  console.error(error);

  return NextResponse.json(
    { error: "Unable to load discovery recommendations." },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const quality = await getProfileQuality(session.ownedProfile);

    if (quality.completeness < 80) {
      return NextResponse.json(
        {
          completed: false,
          error: "Profile completion required",
          profileCompleteness: quality.completeness,
          redirectTo: "/profile/edit",
        },
        { status: 409 },
      );
    }

    const discovery = await getDiscoveryRecommendations(session.ownedProfile);

    if (!discovery.completed) {
      return NextResponse.json(
        {
          completed: false,
          error: "Onboarding required",
          redirectTo: "/onboarding",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(discovery);
  } catch (error) {
    return jsonError(error);
  }
}
