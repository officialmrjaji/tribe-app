import { X } from "lucide-react";
import { redirect } from "next/navigation";
import { ProfileCollectionPage } from "@/components/discovery/profile-collection-page";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getPassedDiscoveryProfiles } from "@/lib/discovery/service";

export default async function PassedProfilesPage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const passedProfiles = await getPassedDiscoveryProfiles(session.ownedProfile);

  if (!passedProfiles.completed) {
    redirect("/onboarding");
  }

  return (
    <ProfileCollectionPage
      accentLabel="Passed"
      description="Profiles you skipped from discovery. Active passes stay out of your recommendation queue."
      emptyBody="Passed profiles stay out of your active recommendations. If you restore someone later, they can return to discovery when they still match your filters."
      emptyTitle="No hidden discovery history yet."
      eyebrow="Discovery history"
      icon={X}
      profiles={passedProfiles.profiles}
      restorePassed
      title="Passed profiles"
    />
  );
}
