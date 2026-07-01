import { NextResponse } from "next/server";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { startRandomVoiceMatch } from "@/lib/voice/service";

export async function POST() {
  const context = await getVoiceSessionContext();

  if ("response" in context) {
    return context.response;
  }

  try {
    const session = await startRandomVoiceMatch(context.ownedProfile);

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return voiceErrorResponse(error, "Unable to start voice match.");
  }
}
