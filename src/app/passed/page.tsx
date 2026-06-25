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
      emptyBody="When you pass a profile from discovery, it moves here and is removed from your current recommendations."
      emptyTitle="No passed profiles yet."
      eyebrow="Discovery history"
      icon={X}
      profiles={passedProfiles.profiles}
      title="Passed profiles"
    />
  );
}
