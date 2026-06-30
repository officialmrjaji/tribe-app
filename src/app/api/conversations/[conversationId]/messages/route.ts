import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { messageInputSchema } from "@/lib/messaging/schema";
import {
  getConversationMessages,
  MessagingError,
  sendConversationMessage,
} from "@/lib/messaging/service";

type ConversationMessagesContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(
  request: Request,
  context: ConversationMessagesContext,
) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const { conversationId } = await context.params;
    const url = new URL(request.url);
    const before = url.searchParams.get("before");
    const limit = Number(url.searchParams.get("limit") ?? "");
    const result = await getConversationMessages(
      session.ownedProfile,
      conversationId,
      {
        before,
        limit: Number.isFinite(limit) ? limit : undefined,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    if (error instanceof MessagingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Unable to load conversation messages." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: ConversationMessagesContext,
) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const payload = await request.json();
    const parsedPayload = messageInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: "Invalid message payload", issues: parsedPayload.error.issues },
        { status: 400 },
      );
    }

    const { conversationId } = await context.params;
    const result = await sendConversationMessage(
      session.ownedProfile,
      conversationId,
      parsedPayload.data.body,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);

    if (error instanceof MessagingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Unable to send message." },
      { status: 500 },
    );
  }
}
