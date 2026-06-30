import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { deleteSquarePost, getSquarePostThread } from "@/lib/square/service";

type SquarePostContext = {
  params: Promise<{ postId: string }>;
};

export async function GET(_request: Request, context: SquarePostContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { postId } = await context.params;
    const thread = await getSquarePostThread(session.ownedProfile, postId);

    return NextResponse.json(thread);
  } catch (error) {
    return squareErrorResponse(error, "Square post could not load.");
  }
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Square post editing is not included in the MVP." },
    { status: 501 },
  );
}

export async function DELETE(_request: Request, context: SquarePostContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { postId } = await context.params;
    const result = await deleteSquarePost({
      ownedProfile: session.ownedProfile,
      postId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square post could not be deleted.");
  }
}
