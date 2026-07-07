import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { continueVoiceSession } from "@/lib/voice/service";

export async function POST(
  request: Request,
  context: RouteContext<"/api/voice/sessions/[sessionId]/continue">,
) {
  const sessionContext = await getVoiceSessionContext();

  if ("response" in sessionContext) {
    return sessionContext.response;
  }

  try {
    const { sessionId } = await context.params;
    await assertRateLimit({
      action: "voice_session_continue",
      key: `voice_continue:${sessionContext.ownedProfile.account.id}:${sessionId}`,
      limit: 6,
      route: "/api/voice/sessions/[sessionId]/continue",
      userId: sessionContext.ownedProfile.account.id,
      windowMs: 10 * 60 * 1000,
    });

    const session = await continueVoiceSession(
      sessionContext.ownedProfile,
      sessionId,
    );

    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(error, {
        fallbackMessage: "Unable to continue voice session.",
        request,
      });
    }

    return voiceErrorResponse(error, "Unable to continue voice session.");
  }
}
