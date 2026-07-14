import { NextResponse } from "next/server";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { voiceRoomActionSchema } from "@/lib/voice/schema";
import { applyVoiceRoomAction } from "@/lib/voice/service";

export async function POST(
  request: Request,
  context: RouteContext<"/api/voice/rooms/[roomId]/actions">,
) {
  const sessionContext = await getVoiceSessionContext();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  try {
    const parsedPayload = voiceRoomActionSchema.safeParse(await request.json());

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid voice room action payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { roomId } = await context.params;
    const room = await applyVoiceRoomAction(
      sessionContext.ownedProfile,
      roomId,
      parsedPayload.data,
    );

    return NextResponse.json({ room });
  } catch (error) {
    return voiceErrorResponse(error, "Unable to update voice room.");
  }
}
