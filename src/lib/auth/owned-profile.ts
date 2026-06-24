import { auth, currentUser } from "@clerk/nextjs/server";
import {
  ensureOwnedProfile,
  getPrimaryEmail,
  type OwnedProfile,
} from "@/lib/profile/service";

export type OwnedProfileSession =
  | {
      ownedProfile: OwnedProfile;
    }
  | {
      error: "Unauthorized" | "User not found";
      status: 401 | 404;
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
    name: user.fullName,
  });

  return { ownedProfile };
}
