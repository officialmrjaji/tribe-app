import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { recordSessionActivity, trackAnalyticsEvent } from "@/lib/analytics/service";
import { assertRateLimit } from "@/lib/security/rate-limit";

const sessionSchema = z.object({
  durationSeconds: z.coerce.number().min(0).max(24 * 60 * 60).default(0),
  ended: z.boolean().default(false),
  path: z.string().max(300).optional(),
  sessionId: z.string().min(8).max(120),
});

export async function POST(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json({ recorded: false }, { status: 202 });
    }

    const payload = sessionSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ recorded: false }, { status: 202 });
    }

    await assertRateLimit({
      action: "analytics_session",
      key: `analytics:${session.ownedProfile.account.id}:${payload.data.sessionId}`,
      limit: 120,
      route: "/api/analytics/session",
      userId: session.ownedProfile.account.id,
      windowMs: 60 * 60 * 1000,
    });

    await recordSessionActivity({
      durationSeconds: payload.data.durationSeconds,
      ended: payload.data.ended,
      metadata: {
        path: payload.data.path ?? null,
      },
      ownedProfile: session.ownedProfile,
      request,
      sessionId: payload.data.sessionId,
    });

    if (!payload.data.ended) {
      await trackAnalyticsEvent({
        eventType: "session_started",
        ownedProfile: session.ownedProfile,
        properties: {
          path: payload.data.path ?? null,
        },
        sessionId: payload.data.sessionId,
        source: "client",
      });
    }

    return NextResponse.json({ recorded: true });
  } catch (error) {
    return apiErrorResponse(error, {
      fallbackMessage: "Unable to record analytics session.",
      request,
    });
  }
}
