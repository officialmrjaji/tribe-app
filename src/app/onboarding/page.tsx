import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/onboarding/service";
import { ensureOwnedProfile, getPrimaryEmail } from "@/lib/profile/service";
import OnboardingFlow from "./onboarding-flow";

export default async function OnboardingPage() {
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
    name: user.fullName,
  });
  const onboarding = await getOnboardingStatus(ownedProfile.profile.id);

  if (onboarding.completed) {
    redirect("/");
  }

  return (
    <OnboardingFlow
      displayName={ownedProfile.profile.display_name ?? user.firstName ?? "there"}
      initialResponse={onboarding.response}
    />
  );
}
