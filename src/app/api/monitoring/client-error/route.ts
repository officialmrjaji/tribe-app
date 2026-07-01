import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api/errors";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { captureException } from "@/lib/monitoring/service";
import { getRequestIdFromHeaders } from "@/lib/observability/logger";
import { assertRateLimit } from "@/lib/security/rate-limit";

const clientErrorSchema = z.object({
  digest: z.string().max(200).optional(),
  message: z.string().max(1000),
  name: z.string().max(120).optional(),
  path: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const session = await getCurrentOwnedProfile();
    const payload = clientErrorSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ recorded: false }, { status: 202 });
    }

    if (!("error" in session)) {
      await assertRateLimit({
        action: "client_error",
        key: `client_error:${session.ownedProfile.account.id}`,
        limit: 40,
        route: "/api/monitoring/client-error",
        userId: session.ownedProfile.account.id,
        windowMs: 60 * 60 * 1000,
      });
    }

    await captureException({
      context: {
        digest: payload.data.digest ?? null,
        path: payload.data.path ?? null,
        userId: "error" in session ? null : session.ownedProfile.account.id,
      },
      error: new Error(payload.data.message),
      requestId,
    });

    return NextResponse.json({ recorded: true });
  } catch (error) {
    return apiErrorResponse(error, {
      fallbackMessage: "Unable to record client error.",
      request,
      requestId,
    });
  }
}
