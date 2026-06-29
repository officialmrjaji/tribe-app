import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/onboarding/service";
import {
  ensureOwnedProfile,
  getPrimaryEmail,
  getPrimaryEmailVerified,
  getProfileQuality,
} from "@/lib/profile/service";
import ProfileEditor from "./profile-editor";

export default async function EditProfilePage() {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const ownedProfile = await ensureOwnedProfile({
    clerkUserId: userId,
    email: getPrimaryEmail(user),
    imageUrl: user.imageUrl,
    isEmailVerified: getPrimaryEmailVerified(user),
    name: user.fullName,
  });
  const onboarding = await getOnboardingStatus(ownedProfile.profile.id);

  if (!onboarding.completed) {
    redirect("/onboarding");
  }

  const quality = await getProfileQuality(ownedProfile);

  return <ProfileEditor profile={ownedProfile.profile} quality={quality} />;
}
