import { NextResponse } from "next/server";
import { apiErrorResponse, badRequest } from "@/lib/api/errors";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getRequestIdFromHeaders } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

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

    const payload = (await request.json().catch(() => ({}))) as {
      confirmed?: unknown;
    };

    if (payload.confirmed !== true) {
      throw badRequest("Account deletion request must be confirmed.");
    }

    const supabase = createSupabaseAdminClient();
    const userId = session.ownedProfile.account.id;

    const { data: existingRequest, error: existingError } = await supabase
      .from("moderation_cases")
      .select("id")
      .eq("subject_type", "user")
      .eq("subject_user_id", userId)
      .eq("reporter_user_id", userId)
      .eq("reason", "account_deletion_request")
      .in("status", ["open", "reviewing"])
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingRequest) {
      return NextResponse.json(
        {
          alreadyRequested: true,
          caseId: existingRequest.id,
          requested: true,
        },
        { headers: { "x-request-id": requestId } },
      );
    }

    const { data, error } = await supabase
      .from("moderation_cases")
      .insert({
        details:
          "User confirmed they understand account removal is permanent. Full Clerk and Supabase deletion is pending safe operational review.",
        priority: "high",
        reason: "account_deletion_request",
        reporter_user_id: userId,
        status: "open",
        subject_id: userId,
        subject_type: "user",
        subject_user_id: userId,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        caseId: data.id,
        requested: true,
      },
      {
        headers: { "x-request-id": requestId },
        status: 201,
      },
    );
  } catch (error) {
    return apiErrorResponse(error, {
      fallbackMessage: "Unable to request account deletion.",
      request,
      requestId,
    });
  }
}
