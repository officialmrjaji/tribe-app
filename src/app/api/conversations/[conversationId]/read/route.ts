import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  markConversationRead,
  MessagingError,
} from "@/lib/messaging/service";

type ConversationReadContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function POST(_request: Request, context: ConversationReadContext) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const { conversationId } = await context.params;
    const result = await markConversationRead(
      session.ownedProfile,
      conversationId,
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
      { error: "Unable to mark conversation as read." },
      { status: 500 },
    );
  }
}
