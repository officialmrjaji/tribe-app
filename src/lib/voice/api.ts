import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { VoiceExperienceError } from "./service";

export async function getVoiceSessionContext() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    return {
      response: NextResponse.json(
        { error: session.error },
        { status: session.status },
      ),
    };
  }

  return { ownedProfile: session.ownedProfile };
}

export function voiceErrorResponse(error: unknown, fallback: string) {
  console.error(error);

  if (error instanceof VoiceExperienceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}
