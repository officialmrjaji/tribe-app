import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { squarePollVoteInputSchema } from "@/lib/square/schema";
import { voteSquarePoll } from "@/lib/square/service";

type SquarePollVoteContext = {
  params: Promise<{ postId: string }>;
};

export async function POST(request: Request, context: SquarePollVoteContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const payload = await request.json();
    const parsedPayload = squarePollVoteInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid poll vote payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { postId } = await context.params;
    const result = await voteSquarePoll({
      optionId: parsedPayload.data.optionId,
      ownedProfile: session.ownedProfile,
      postId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Poll vote could not be saved.");
  }
}
