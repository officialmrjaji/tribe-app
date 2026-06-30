import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { squareCommentInputSchema } from "@/lib/square/schema";
import { createSquareComment, listSquareComments } from "@/lib/square/service";

type SquareCommentsContext = {
  params: Promise<{ postId: string }>;
};

export async function GET(_request: Request, context: SquareCommentsContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { postId } = await context.params;
    const comments = await listSquareComments(session.ownedProfile, postId);

    return NextResponse.json({ comments });
  } catch (error) {
    return squareErrorResponse(error, "Square comments could not load.");
  }
}

export async function POST(request: Request, context: SquareCommentsContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const payload = await request.json();
    const parsedPayload = squareCommentInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid Square comment payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { postId } = await context.params;
    const comment = await createSquareComment({
      body: parsedPayload.data.body,
      ownedProfile: session.ownedProfile,
      postId,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return squareErrorResponse(error, "Square comment could not be created.");
  }
}
