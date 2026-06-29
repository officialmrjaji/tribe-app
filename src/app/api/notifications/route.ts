import { NextResponse } from "next/server";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { listNotifications } from "@/lib/notifications/service";

export async function GET(request: Request) {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "40");
    const result = await listNotifications(
      session.ownedProfile,
      Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 80) : 40,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unable to load notifications." },
      { status: 500 },
    );
  }
}
