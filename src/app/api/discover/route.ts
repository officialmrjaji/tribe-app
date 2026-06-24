import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getDiscoveryRecommendations } from "@/lib/discovery/service";

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
