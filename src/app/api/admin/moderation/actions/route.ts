import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAdminAccess, performModerationAction } from "@/lib/admin/service";
import { moderationActionSchema } from "@/lib/admin/schema";
import { getRequestIdFromHeaders } from "@/lib/observability/logger";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const admin = await requireAdminAccess();
    await assertRateLimit({
      action: "admin_moderation_action",
      key: `admin:moderation:${admin.ownedProfile.account.id}`,
      limit: 60,
      route: "/api/admin/moderation/actions",
      userId: admin.ownedProfile.account.id,
      windowMs: 60 * 60 * 1000,
    });

    const payload = moderationActionSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            details: payload.error.issues,
            message: "Invalid moderation action payload.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const result = await performModerationAction({
      admin,
      input: payload.data,
      requestId,
    });

    return NextResponse.json(result, {
      headers: { "x-request-id": requestId },
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error, {
      fallbackMessage: "Unable to perform moderation action.",
      request,
      requestId,
    });
  }
}
