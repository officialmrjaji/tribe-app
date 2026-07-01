import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { getVoiceSessionContext, voiceErrorResponse } from "@/lib/voice/api";
import { startRandomVoiceMatch } from "@/lib/voice/service";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const context = await getVoiceSessionContext();

  if ("response" in context) {
    return context.response;
  }

  try {
    await assertRateLimit({
      action: "voice_match_start",
      key: `voice_match:${context.ownedProfile.account.id}`,
      limit: 12,
      route: "/api/voice/match",
      userId: context.ownedProfile.account.id,
      windowMs: 60 * 60 * 1000,
    });
    const session = await startRandomVoiceMatch(context.ownedProfile);
    await Promise.all([
      trackAnalyticsEvent({
        eventType: "voice_session_started",
        ownedProfile: context.ownedProfile,
        properties: {
          sessionId: session.id,
        },
      }),
      trackAnalyticsEvent({
        eventType: "voice_usage",
        ownedProfile: context.ownedProfile,
        properties: {
          action: "random_match_started",
        },
      }),
    ]);

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(error, {
        fallbackMessage: "Unable to start voice match.",
        request,
      });
    }

    return voiceErrorResponse(error, "Unable to start voice match.");
  }
}
