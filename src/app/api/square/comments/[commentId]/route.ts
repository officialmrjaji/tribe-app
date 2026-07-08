import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { squareCommentEditInputSchema } from "@/lib/square/schema";
import { deleteSquareComment, updateSquareComment } from "@/lib/square/service";

type SquareCommentContext = {
  params: Promise<{ commentId: string }>;
};

export async function PATCH(request: Request, context: SquareCommentContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const payload = await request.json();
    const parsedPayload = squareCommentEditInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid Square comment edit payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { commentId } = await context.params;
    const comment = await updateSquareComment({
      commentId,
      input: parsedPayload.data,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json({ comment });
  } catch (error) {
    return squareErrorResponse(error, "Square comment could not be edited.");
  }
}

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
