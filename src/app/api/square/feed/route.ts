import { NextResponse } from "next/server";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { listSquareFeed } from "@/lib/square/service";

export async function GET(request: Request) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const url = new URL(request.url);
    const topicSlug = url.searchParams.get("topic") ?? undefined;
    const result = await listSquareFeed({
      ownedProfile: session.ownedProfile,
      topicSlug,
    });
    await trackAnalyticsEvent({
      eventType: "square_usage",
      ownedProfile: session.ownedProfile,
      properties: {
        action: "feed_viewed",
        postCount: result.posts.length,
        topicSlug: topicSlug ?? null,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Square feed could not be loaded.");
  }
}
