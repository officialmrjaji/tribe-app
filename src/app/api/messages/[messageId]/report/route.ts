import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { messageReportSchema } from "@/lib/messaging/schema";
import { MessagingError, reportMessage } from "@/lib/messaging/service";

type MessageReportContext = {
  params: Promise<{
    messageId: string;
  }>;
};

export async function POST(request: Request, context: MessageReportContext) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const payload = await request.json();
    const parsedPayload = messageReportSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid message report payload",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const { messageId } = await context.params;
    const result = await reportMessage({
      details: parsedPayload.data.details,
      messageId,
      ownedProfile: session.ownedProfile,
      reason: parsedPayload.data.reason,
    });

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
      { error: "Unable to report message." },
      { status: 500 },
    );
  }
}
