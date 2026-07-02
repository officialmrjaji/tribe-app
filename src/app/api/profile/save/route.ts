import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { profileActionSchema } from "@/lib/discovery/schema";
import { saveDiscoveryProfile } from "@/lib/discovery/service";
import { ProfileQualityRequirementError } from "@/lib/profile/service";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const payload = await request.json();
    const parsedPayload = profileActionSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: "Invalid like payload", issues: parsedPayload.error.issues },
        { status: 400 },
      );
    }

    await assertRateLimit({
      action: "profile_save",
      key: `profile_save:${session.ownedProfile.account.id}`,
      limit: 30,
      route: "/api/profile/save",
      userId: session.ownedProfile.account.id,
      windowMs: 60 * 60 * 1000,
    });

    const result = await saveDiscoveryProfile(
      session.ownedProfile,
      parsedPayload.data.profileId,
    );
    await trackAnalyticsEvent({
      eventType: "profile_saved",
      ownedProfile: session.ownedProfile,
      properties: {
        profileId: parsedPayload.data.profileId,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);

    if (error instanceof ApiError) {
      return apiErrorResponse(error, {
        fallbackMessage: "Unable to like profile.",
        request,
      });
    }

    if (error instanceof ProfileQualityRequirementError) {
      return NextResponse.json(
        {
          error: error.message,
          requiredPhotoCount: error.requiredPhotoCount,
          uploadedPhotoCount: error.uploadedPhotoCount,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Unable to like profile." },
      { status: 500 },
    );
  }
}
