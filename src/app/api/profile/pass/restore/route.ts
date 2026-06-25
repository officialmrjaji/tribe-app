import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { profileActionSchema } from "@/lib/discovery/schema";
import { restorePassedProfile } from "@/lib/discovery/service";

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
        {
          error: "Invalid restore payload",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const result = await restorePassedProfile(
      session.ownedProfile,
      parsedPayload.data.profileId,
    );

    if (!result.restored) {
      return NextResponse.json(
        { error: "Passed profile was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to restore passed profile." },
      { status: 500 },
    );
  }
}
