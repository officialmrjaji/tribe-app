import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { toggleSquareLike } from "@/lib/square/service";

type SquareLikeContext = {
  params: Promise<{ postId: string }>;
};

export async function POST(_request: Request, context: SquareLikeContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { postId } = await context.params;
    const result = await toggleSquareLike({
      liked: true,
      ownedProfile: session.ownedProfile,
      postId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square post could not be liked.");
  }
}

export async function DELETE(_request: Request, context: SquareLikeContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { postId } = await context.params;
    const result = await toggleSquareLike({
      liked: false,
      ownedProfile: session.ownedProfile,
      postId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square post could not be unliked.");
  }
}
