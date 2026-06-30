import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { listSquareFeed } from "@/lib/square/service";

type SquareTopicContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: SquareTopicContext) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const { slug } = await context.params;
    const result = await listSquareFeed({
      ownedProfile: session.ownedProfile,
      topicSlug: slug,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square topic could not load.");
  }
}
