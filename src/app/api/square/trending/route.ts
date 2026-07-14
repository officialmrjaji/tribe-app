import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { listSquareFeed } from "@/lib/square/service";

export async function GET() {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const result = await listSquareFeed({
      ownedProfile: session.ownedProfile,
      trendingOnly: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return squareErrorResponse(error, "Trending could not load.");
  }
}
