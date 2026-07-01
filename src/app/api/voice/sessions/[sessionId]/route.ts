import { NextResponse } from "next/server";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { getVoiceSession } from "@/lib/voice/service";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/voice/sessions/[sessionId]">,
) {
  const sessionContext = await getVoiceSessionContext();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  try {
    const { sessionId } = await context.params;
    const session = await getVoiceSession(sessionContext.ownedProfile, sessionId);

    return NextResponse.json({ session });
  } catch (error) {
    return voiceErrorResponse(error, "Unable to load voice session.");
  }
}
