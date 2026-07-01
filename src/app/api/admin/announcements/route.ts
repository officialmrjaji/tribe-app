import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { announcementCreateSchema } from "@/lib/admin/schema";
import { createAnnouncement, requireAdminAccess } from "@/lib/admin/service";
import { getRequestIdFromHeaders } from "@/lib/observability/logger";

export async function POST(request: Request) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const admin = await requireAdminAccess();
    const payload = announcementCreateSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            details: payload.error.issues,
            message: "Invalid announcement payload.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const result = await createAnnouncement({
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
      fallbackMessage: "Unable to create announcement.",
      request,
      requestId,
    });
  }
}
