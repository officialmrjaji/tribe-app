import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { squarePostEditInputSchema } from "@/lib/square/schema";
import {
  deleteSquarePost,
  getSquarePostThread,
  updateSquarePost,
} from "@/lib/square/service";

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

export async function PATCH(request: Request, context: SquarePostContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const payload = await request.json();
    const parsedPayload = squarePostEditInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid Square post edit payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { postId } = await context.params;
    const post = await updateSquarePost({
      input: parsedPayload.data,
      ownedProfile: session.ownedProfile,
      postId,
    });

    return NextResponse.json({ post });
  } catch (error) {
    return squareErrorResponse(error, "Square post could not be edited.");
  }
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
