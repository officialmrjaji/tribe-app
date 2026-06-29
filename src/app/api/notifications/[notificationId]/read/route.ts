import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { markNotificationRead } from "@/lib/notifications/service";

type NotificationReadContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function POST(_request: Request, context: NotificationReadContext) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const { notificationId } = await context.params;
    const result = await markNotificationRead(
      session.ownedProfile,
      notificationId,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to mark notification as read." },
      { status: 500 },
    );
  }
}
