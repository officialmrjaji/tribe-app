import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getOnboardingStatus,
  saveOnboardingResponse,
} from "@/lib/onboarding/service";
import { onboardingInputSchema } from "@/lib/onboarding/schema";
import { ensureOwnedProfile, getPrimaryEmail } from "@/lib/profile/service";

async function getCurrentOwnedProfile() {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return { error: "Unauthorized" as const, status: 401 as const };
  }

  const user = await currentUser();

  if (!user) {
    return { error: "User not found" as const, status: 404 as const };
  }

  const ownedProfile = await ensureOwnedProfile({
    clerkUserId: userId,
    email: getPrimaryEmail(user),
    imageUrl: user.imageUrl,
    name: user.fullName,
  });

  return { ownedProfile };
}

function jsonError(error: unknown) {
  console.error(error);

  return NextResponse.json(
    { error: "Unable to process onboarding request." },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const session = await getCurrentOwnedProfile();

    if ("error" in session) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      );
    }

    const onboarding = await getOnboardingStatus(session.ownedProfile.profile.id);

    return NextResponse.json({
      completed: onboarding.completed,
      onboarding: onboarding.response,
      profile: session.ownedProfile.profile,
    });
  } catch (error) {
    return jsonError(error);
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
    const parsedPayload = onboardingInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid onboarding payload",
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    const onboarding = await saveOnboardingResponse(
      session.ownedProfile,
      parsedPayload.data,
    );

    return NextResponse.json({ completed: true, onboarding }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}
