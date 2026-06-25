import { Heart } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getSavedDiscoveryProfiles } from "@/lib/discovery/service";
import { ProfileCollectionPage } from "@/components/discovery/profile-collection-page";

export default async function SavedProfilesPage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const savedProfiles = await getSavedDiscoveryProfiles(session.ownedProfile);

  if (!savedProfiles.completed) {
    redirect("/onboarding");
  }

  return (
    <ProfileCollectionPage
      accentLabel="Saved"
      description="People you marked as worth returning to, with the same personality-first signals from discovery."
      emptyBody="Save people from discovery when a profile feels promising. They will appear here for quick review."
      emptyTitle="No saved profiles yet."
      eyebrow="Discovery library"
      icon={Heart}
      profiles={savedProfiles.profiles}
      title="Saved profiles"
    />
  );
}
