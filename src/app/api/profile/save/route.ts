import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { profileActionSchema } from "@/lib/discovery/schema";
import { saveDiscoveryProfile } from "@/lib/discovery/service";
import { ProfileQualityRequirementError } from "@/lib/profile/service";

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
        { error: "Invalid save payload", issues: parsedPayload.error.issues },
        { status: 400 },
      );
    }

    const result = await saveDiscoveryProfile(
      session.ownedProfile,
      parsedPayload.data.profileId,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);

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
      { error: "Unable to save profile." },
      { status: 500 },
    );
  }
}
