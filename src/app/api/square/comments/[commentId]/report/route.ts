import { NextResponse } from "next/server";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { squareReportInputSchema } from "@/lib/square/schema";
import { reportSquareComment } from "@/lib/square/service";

type SquareCommentReportContext = {
  params: Promise<{ commentId: string }>;
};

export async function POST(
  request: Request,
  context: SquareCommentReportContext,
) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const payload = await request.json();
    const parsedPayload = squareReportInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid Square report payload.",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { commentId } = await context.params;
    const result = await reportSquareComment({
      commentId,
      details: parsedPayload.data.details,
      ownedProfile: session.ownedProfile,
      reason: parsedPayload.data.reason,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return squareErrorResponse(error, "Square comment could not be reported.");
  }
}
