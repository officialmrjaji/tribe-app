import { NextResponse } from "next/server";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { getVoiceRoom } from "@/lib/voice/service";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/voice/rooms/[roomId]">,
) {
  const sessionContext = await getVoiceSessionContext();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  try {
    const { roomId } = await context.params;
    const room = await getVoiceRoom(sessionContext.ownedProfile, roomId);

    return NextResponse.json({ room });
  } catch (error) {
    return voiceErrorResponse(error, "Unable to load voice room.");
  }
}
