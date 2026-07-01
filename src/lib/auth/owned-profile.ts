import { auth, currentUser } from "@clerk/nextjs/server";
import {
  ensureOwnedProfile,
  getPrimaryEmailVerified,
  getPrimaryEmail,
  type OwnedProfile,
} from "@/lib/profile/service";

export type OwnedProfileSession =
  | {
      ownedProfile: OwnedProfile;
    }
  | {
      error:
        | "Account banned"
        | "Account suspended"
        | "Unauthorized"
        | "User not found";
      status: 401 | 403 | 404;
    };

export async function getCurrentOwnedProfile(): Promise<OwnedProfileSession> {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await currentUser();

  if (!user) {
    return { error: "User not found", status: 404 };
  }

  const ownedProfile = await ensureOwnedProfile({
    clerkUserId: userId,
    email: getPrimaryEmail(user),
    imageUrl: user.imageUrl,
    isEmailVerified: getPrimaryEmailVerified(user),
    name: user.fullName,
  });

  if (ownedProfile.account.moderation_status === "banned") {
    return { error: "Account banned", status: 403 };
  }

  if (
    ownedProfile.account.moderation_status === "suspended" &&
    isFutureDate(ownedProfile.account.suspended_until)
  ) {
    return { error: "Account suspended", status: 403 };
  }

  return { ownedProfile };
}

function isFutureDate(value?: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}
