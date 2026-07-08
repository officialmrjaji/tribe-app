import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { toggleSquareCommentLike } from "@/lib/square/service";

type SquareCommentLikeContext = {
  params: Promise<{ commentId: string }>;
};

export async function POST(_request: Request, context: SquareCommentLikeContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { commentId } = await context.params;
    const result = await toggleSquareCommentLike({
      commentId,
      liked: true,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square comment could not be liked.");
  }
}

export async function DELETE(
  _request: Request,
  context: SquareCommentLikeContext,
) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { commentId } = await context.params;
    const result = await toggleSquareCommentLike({
      commentId,
      liked: false,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square comment could not be unliked.");
  }
}
