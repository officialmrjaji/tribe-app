import { NextResponse } from "next/server";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { revealVoiceSession } from "@/lib/voice/service";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/voice/sessions/[sessionId]/reveal">,
) {
  const sessionContext = await getVoiceSessionContext();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  try {
    const { sessionId } = await context.params;
    const session = await revealVoiceSession(
      sessionContext.ownedProfile,
      sessionId,
    );

    return NextResponse.json({ session });
  } catch (error) {
    return voiceErrorResponse(error, "Unable to reveal voice match.");
  }
}
