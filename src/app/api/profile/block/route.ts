import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { profileReportSchema } from "@/lib/discovery/schema";
import { blockDiscoveryProfile } from "@/lib/discovery/service";

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
    const parsedPayload = profileReportSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: "Invalid block payload", issues: parsedPayload.error.issues },
        { status: 400 },
      );
    }

    const result = await blockDiscoveryProfile(
      session.ownedProfile,
      parsedPayload.data.profileId,
      parsedPayload.data.reason,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to block profile." },
      { status: 500 },
    );
  }
}
