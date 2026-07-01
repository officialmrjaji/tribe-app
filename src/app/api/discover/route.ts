import { NextResponse } from "next/server";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getDiscoveryRecommendations } from "@/lib/discovery/service";
import { getOnboardingStatus } from "@/lib/onboarding/service";
import {
  getProfileQuality,
  profilePhotoRequirementMessage,
} from "@/lib/profile/service";

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

    const onboarding = await getOnboardingStatus(session.ownedProfile.profile.id);

    if (!onboarding.completed) {
      return NextResponse.json(
        {
          completed: false,
          error: "Onboarding required",
          redirectTo: "/onboarding",
        },
        { status: 409 },
      );
    }

    const quality = await getProfileQuality(session.ownedProfile);

    if (!quality.hasMinimumPhotos) {
      return NextResponse.json(
        {
          completed: false,
          error: profilePhotoRequirementMessage,
          profileCompleteness: quality.completeness,
          requiredPhotoCount: quality.minimumPhotoCount,
          uploadedPhotoCount: quality.uploadedPhotoCount,
          redirectTo: "/profile/edit",
        },
        { status: 409 },
      );
    }

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
    await trackAnalyticsEvent({
      eventType: "discovery_impression",
      ownedProfile: session.ownedProfile,
      properties: {
        profileCount: discovery.completed ? discovery.profiles.length : 0,
      },
    });

    return NextResponse.json(discovery);
  } catch (error) {
    return jsonError(error);
  }
}
