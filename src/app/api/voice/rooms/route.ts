import { NextResponse } from "next/server";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { createVoiceRoomSchema } from "@/lib/voice/schema";
import { createVoiceRoom, listVoiceRooms } from "@/lib/voice/service";

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

    const room = await createVoiceRoom(context.ownedProfile, parsedPayload.data);

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    return voiceErrorResponse(error, "Unable to create voice room.");
  }
}
