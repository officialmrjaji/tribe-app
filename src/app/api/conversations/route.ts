import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { conversationCreateSchema } from "@/lib/messaging/schema";
import {
  createConversation,
  listConversations,
  MessagingError,
} from "@/lib/messaging/service";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function GET() {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const result = await listConversations(session.ownedProfile);

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to load conversations." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const payload = await request.json();
    const parsedPayload = conversationCreateSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid conversation payload",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    await assertRateLimit({
      action: "conversation_create",
      key: `conversation_create:${session.ownedProfile.account.id}`,
      limit: 20,
      route: "/api/conversations",
      userId: session.ownedProfile.account.id,
      windowMs: 60 * 60 * 1000,
    });

    const result = await createConversation(
      session.ownedProfile,
      parsedPayload.data.profileId,
    );
    await trackAnalyticsEvent({
      eventType: "conversation_started",
      ownedProfile: session.ownedProfile,
      properties: {
        conversationId: result.conversation.id,
        created: result.created,
      },
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    console.error(error);

    if (error instanceof MessagingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof ApiError) {
      return apiErrorResponse(error, {
        fallbackMessage: "Unable to create conversation.",
        request,
      });
    }

    return NextResponse.json(
      { error: "Unable to create conversation." },
      { status: 500 },
    );
  }
}
