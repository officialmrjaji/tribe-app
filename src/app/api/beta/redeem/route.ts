import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest } from "@/lib/api/errors";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { betaInviteSchema } from "@/lib/beta/schema";
import { redeemBetaInvite } from "@/lib/beta/service";
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
      action: "beta_invite_redeem",
      key: `beta-invite:${session.ownedProfile.account.id}`,
      limit: 10,
      route: "/api/beta/redeem",
      userId: session.ownedProfile.account.id,
      windowMs: 15 * 60 * 1000,
    });

    const parsed = betaInviteSchema.safeParse(
      await request.json().catch(() => ({})),
    );

    if (!parsed.success) {
      throw badRequest(
        parsed.error.issues[0]?.message ?? "Enter a valid invite code.",
        parsed.error.issues,
      );
    }

    const result = await redeemBetaInvite({
      code: parsed.data.code,
      userId: session.ownedProfile.account.id,
    });

    return NextResponse.json(
      {
        accessGranted: true,
        alreadyRedeemed: result.alreadyRedeemed,
      },
      {
        headers: { "x-request-id": requestId },
        status: result.alreadyRedeemed ? 200 : 201,
      },
    );
  } catch (error) {
    return apiErrorResponse(error, {
      fallbackMessage: "The invite code could not be verified.",
      request,
      requestId,
    });
  }
}
