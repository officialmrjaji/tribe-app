import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  ensureOwnedProfile,
  getOwnedProfile,
  getPrimaryEmail,
  getPrimaryEmailVerified,
  ProfileIdentityLockedError,
  getProfileQuality,
  updateOwnedProfile,
} from "@/lib/profile/service";
import { profileInputSchema } from "@/lib/profile/schema";

export async function GET() {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownedProfile = await getOwnedProfile(userId);

  if (!ownedProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...ownedProfile,
    quality: await getProfileQuality(ownedProfile),
  });
}

export async function POST() {
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
    isEmailVerified: getPrimaryEmailVerified(user),
    name: user.fullName,
  });

  return NextResponse.json(
    {
      ...ownedProfile,
      quality: await getProfileQuality(ownedProfile),
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsedPayload = profileInputSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: "Invalid profile payload", issues: parsedPayload.error.issues },
      { status: 400 },
    );
  }

  let ownedProfile;

  try {
    ownedProfile = await updateOwnedProfile(userId, parsedPayload.data);
  } catch (error) {
    if (error instanceof ProfileIdentityLockedError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    throw error;
  }

  if (!ownedProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...ownedProfile,
    quality: await getProfileQuality(ownedProfile),
  });
}
