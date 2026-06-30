import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { deleteSquareComment } from "@/lib/square/service";

type SquareCommentContext = {
  params: Promise<{ commentId: string }>;
};

export async function DELETE(_request: Request, context: SquareCommentContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { commentId } = await context.params;
    const result = await deleteSquareComment({
      commentId,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square comment could not be deleted.");
  }
}
