import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { muteSquareUser } from "@/lib/square/service";

type SquareMuteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(_request: Request, context: SquareMuteContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { userId } = await context.params;
    const result = await muteSquareUser({
      muted: true,
      mutedUserId: userId,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square user could not be muted.");
  }
}

export async function DELETE(_request: Request, context: SquareMuteContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { userId } = await context.params;
    const result = await muteSquareUser({
      muted: false,
      mutedUserId: userId,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square user could not be unmuted.");
  }
}
