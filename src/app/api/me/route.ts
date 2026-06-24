import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureOwnedProfile, getPrimaryEmail } from "@/lib/profile/service";

export async function GET() {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ownedProfile = await ensureOwnedProfile({
    clerkUserId: userId,
    email: getPrimaryEmail(user),
    imageUrl: user.imageUrl,
    name: user.fullName,
  });

  return NextResponse.json({
    account: ownedProfile.account,
    profile: ownedProfile.profile,
    session: {
      clerkUserId: userId,
      isAuthenticated,
    },
  });
}
