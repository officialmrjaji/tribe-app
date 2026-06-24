import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { profileActionSchema } from "@/lib/discovery/schema";
import { passDiscoveryProfile } from "@/lib/discovery/service";

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
        { error: "Invalid pass payload", issues: parsedPayload.error.issues },
        { status: 400 },
      );
    }

    const result = await passDiscoveryProfile(
      session.ownedProfile,
      parsedPayload.data.profileId,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to pass profile." },
      { status: 500 },
    );
  }
}
