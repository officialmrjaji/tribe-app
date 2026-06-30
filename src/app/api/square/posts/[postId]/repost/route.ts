import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { squareRepostInputSchema } from "@/lib/square/schema";
import { repostSquarePost } from "@/lib/square/service";

type SquareRepostContext = {
  params: Promise<{ postId: string }>;
};

export async function POST(request: Request, context: SquareRepostContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const payload = await request.json().catch(() => ({}));
    const parsedPayload = squareRepostInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid repost payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { postId } = await context.params;
    const result = await repostSquarePost({
      commentary: parsedPayload.data.commentary,
      ownedProfile: session.ownedProfile,
      postId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square post could not be reposted.");
  }
}
