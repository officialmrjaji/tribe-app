import { NextResponse } from "next/server";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { voiceRoomChatReportSchema } from "@/lib/voice/schema";
import { reportVoiceRoomMessage } from "@/lib/voice/service";

export async function POST(
  request: Request,
  context: RouteContext<"/api/voice/rooms/[roomId]/chat/[messageId]/report">,
) {
  const sessionContext = await getVoiceSessionContext();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  try {
    const parsedPayload = voiceRoomChatReportSchema.safeParse(
      await request.json(),
    );

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid room message report payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { messageId, roomId } = await context.params;
    const result = await reportVoiceRoomMessage(
      sessionContext.ownedProfile,
      roomId,
      messageId,
      parsedPayload.data,
    );

    return NextResponse.json(result);
  } catch (error) {
    return voiceErrorResponse(error, "Room message could not be reported.");
  }
}
