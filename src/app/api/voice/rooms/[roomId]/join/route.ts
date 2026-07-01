import { NextResponse } from "next/server";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { joinVoiceRoomSchema } from "@/lib/voice/schema";
import { joinVoiceRoom } from "@/lib/voice/service";

export async function POST(
  request: Request,
  context: RouteContext<"/api/voice/rooms/[roomId]/join">,
) {
  const sessionContext = await getVoiceSessionContext();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  try {
    const parsedPayload = joinVoiceRoomSchema.safeParse(await request.json());

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid voice room join payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { roomId } = await context.params;
    const room = await joinVoiceRoom(
      sessionContext.ownedProfile,
      roomId,
      parsedPayload.data.inviteCode,
    );

    return NextResponse.json({ room });
  } catch (error) {
    return voiceErrorResponse(error, "Unable to join voice room.");
  }
}
