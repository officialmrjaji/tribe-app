import { NextResponse } from "next/server";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { discoveryFiltersSchema } from "@/lib/discovery/schema";
import { getDiscoveryRecommendations } from "@/lib/discovery/service";
import { getOnboardingStatus } from "@/lib/onboarding/service";
import {
  getProfileQuality,
  minimumBasicProfileCompletion,
  profilePhotoRequirementMessage,
} from "@/lib/profile/service";

function jsonError(error: unknown) {
  console.error(error);

  return NextResponse.json(
    { error: "Unable to load discovery recommendations." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
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

    if (quality.completeness < minimumBasicProfileCompletion) {
      return NextResponse.json(
        {
          completed: false,
          error: `Complete at least ${minimumBasicProfileCompletion}% of your profile to open People.`,
          profileCompleteness: quality.completeness,
          redirectTo: "/profile/edit",
        },
        { status: 409 },
      );
    }

    const url = new URL(request.url);
    const parsedFilters = discoveryFiltersSchema.safeParse({
      gender: url.searchParams.get("gender") || undefined,
      maxAge: url.searchParams.get("maxAge") || undefined,
      minAge: url.searchParams.get("minAge") || undefined,
    });

    if (!parsedFilters.success) {
      return NextResponse.json(
        {
          error: "Invalid discovery filters.",
          issues: parsedFilters.error.issues,
        },
        { status: 400 },
      );
    }

    const discovery = await getDiscoveryRecommendations(
      session.ownedProfile,
      parsedFilters.data,
    );
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
