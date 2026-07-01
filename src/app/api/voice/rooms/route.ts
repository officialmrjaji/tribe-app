import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { createVoiceRoomSchema } from "@/lib/voice/schema";
import { createVoiceRoom, listVoiceRooms } from "@/lib/voice/service";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function GET() {
  const context = await getVoiceSessionContext();

  if ("response" in context) {
    return context.response;
  }

  try {
    const rooms = await listVoiceRooms(context.ownedProfile);

    return NextResponse.json({ rooms });
  } catch (error) {
    return voiceErrorResponse(error, "Unable to load voice rooms.");
  }
}

export async function POST(request: Request) {
  const context = await getVoiceSessionContext();

  if ("response" in context) {
    return context.response;
  }

  try {
    const parsedPayload = createVoiceRoomSchema.safeParse(await request.json());

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid voice room payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    await assertRateLimit({
      action: "voice_room_create",
      key: `voice_room:${context.ownedProfile.account.id}`,
      limit: 10,
      route: "/api/voice/rooms",
      userId: context.ownedProfile.account.id,
      windowMs: 24 * 60 * 60 * 1000,
    });
    const room = await createVoiceRoom(context.ownedProfile, parsedPayload.data);
    await Promise.all([
      trackAnalyticsEvent({
        eventType: "voice_room_created",
        ownedProfile: context.ownedProfile,
        properties: {
          roomId: room.id,
          roomType: room.roomType,
        },
      }),
      trackAnalyticsEvent({
        eventType: "voice_usage",
        ownedProfile: context.ownedProfile,
        properties: {
          action: "room_created",
          roomType: room.roomType,
        },
      }),
    ]);

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(error, {
        fallbackMessage: "Unable to create voice room.",
        request,
      });
    }

    return voiceErrorResponse(error, "Unable to create voice room.");
  }
}
