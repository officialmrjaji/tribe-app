import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { featureFlagUpdateSchema } from "@/lib/admin/schema";
import { requireAdminAccess, upsertFeatureFlag } from "@/lib/admin/service";
import { getRequestIdFromHeaders } from "@/lib/observability/logger";

export async function POST(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const admin = await requireAdminAccess();
    const payload = featureFlagUpdateSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            details: payload.error.issues,
            message: "Invalid feature flag payload.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const result = await upsertFeatureFlag({
      admin,
      input: payload.data,
      requestId,
    });

    return NextResponse.json(result, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return apiErrorResponse(error, {
      fallbackMessage: "Unable to update feature flag.",
      request,
      requestId,
    });
  }
}
