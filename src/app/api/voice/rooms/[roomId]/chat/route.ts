import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { recordSpamSignal } from "@/lib/security/spam";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { voiceRoomChatInputSchema } from "@/lib/voice/schema";
import {
  listVoiceRoomMessages,
  sendVoiceRoomMessage,
} from "@/lib/voice/service";

export async function GET(
  request: Request,
  context: RouteContext<"/api/voice/rooms/[roomId]/chat">,
) {
  const sessionContext = await getVoiceSessionContext();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  try {
    const { roomId } = await context.params;
    const url = new URL(request.url);
    const before = url.searchParams.get("before");
    const limit = Number(url.searchParams.get("limit") ?? "");
    const result = await listVoiceRoomMessages(
      sessionContext.ownedProfile,
      roomId,
      {
        before,
        limit: Number.isFinite(limit) ? limit : undefined,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return voiceErrorResponse(error, "Unable to load room chat.");
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/voice/rooms/[roomId]/chat">,
) {
  const sessionContext = await getVoiceSessionContext();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const parsedPayload = voiceRoomChatInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid room chat payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { roomId } = await context.params;
    await assertRateLimit({
      action: "voice_room_chat_send",
      key: `voice_room_chat:${sessionContext.ownedProfile.account.id}:${roomId}`,
      limit: 30,
      route: "/api/voice/rooms/[roomId]/chat",
      userId: sessionContext.ownedProfile.account.id,
      windowMs: 60 * 60 * 1000,
    });
    await recordSpamSignal({
      content: parsedPayload.data.body,
      contentType: "voice_room_message",
      ownedProfile: sessionContext.ownedProfile,
    });
    const result = await sendVoiceRoomMessage(
      sessionContext.ownedProfile,
      roomId,
      parsedPayload.data,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(error, {
        fallbackMessage: "Unable to send room message.",
        request,
      });
    }

    return voiceErrorResponse(error, "Unable to send room message.");
  }
}
