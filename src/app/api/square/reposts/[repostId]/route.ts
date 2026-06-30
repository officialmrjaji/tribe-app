import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { deleteSquareRepost } from "@/lib/square/service";

type SquareRepostDeleteContext = {
  params: Promise<{ repostId: string }>;
};

export async function DELETE(
  _request: Request,
  context: SquareRepostDeleteContext,
) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { repostId } = await context.params;
    const result = await deleteSquareRepost({
      ownedProfile: session.ownedProfile,
      repostId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square repost could not be deleted.");
  }
}
