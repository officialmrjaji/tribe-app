import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest } from "@/lib/api/errors";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { betaFeedbackSchema } from "@/lib/beta/schema";
import { submitBetaFeedback } from "@/lib/beta/service";
import { getRequestIdFromHeaders } from "@/lib/observability/logger";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        {
          error: {
            code: session.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
            message: session.error,
            requestId,
          },
        },
        { status: session.status },
      );
    }

    await assertRateLimit({
      action: "beta_feedback_submit",
      key: `beta-feedback:${session.ownedProfile.account.id}`,
      limit: 5,
      route: "/api/feedback",
      userId: session.ownedProfile.account.id,
      windowMs: 60 * 60 * 1000,
    });

    const parsed = betaFeedbackSchema.safeParse(
      await request.json().catch(() => ({})),
    );

    if (!parsed.success) {
      throw badRequest(
        parsed.error.issues[0]?.message ?? "Check your feedback and try again.",
        parsed.error.issues,
      );
    }

    const feedback = await submitBetaFeedback({
      input: parsed.data,
      ownedProfile: session.ownedProfile,
    });

    return NextResponse.json(feedback, {
      headers: { "x-request-id": requestId },
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error, {
      fallbackMessage: "Your feedback could not be submitted.",
      request,
      requestId,
    });
  }
}
