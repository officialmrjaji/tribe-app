import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { undoLastPassedProfile } from "@/lib/discovery/service";

export async function POST() {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const result = await undoLastPassedProfile(session.ownedProfile);

    if (!result.undone) {
      return NextResponse.json(
        { error: "No passed profile to undo." },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to undo last pass." },
      { status: 500 },
    );
  }
}
