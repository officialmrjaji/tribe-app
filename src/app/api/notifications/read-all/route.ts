import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { markAllNotificationsRead } from "@/lib/notifications/service";

export async function POST() {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const result = await markAllNotificationsRead(session.ownedProfile);

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to mark notifications as read." },
      { status: 500 },
    );
  }
}
