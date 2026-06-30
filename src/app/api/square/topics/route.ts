import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { listSquareTopics, listTrendingTopics } from "@/lib/square/service";

export async function GET() {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const [topics, trendingTopics] = await Promise.all([
      listSquareTopics(),
      listTrendingTopics(),
    ]);

    return NextResponse.json({ topics, trendingTopics });
  } catch (error) {
    return squareErrorResponse(error, "Square topics could not load.");
  }
}
