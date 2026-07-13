import { redirect } from "next/navigation";
import { PublicProfileView } from "@/components/profile/public-profile-view";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getPublicMemberProfile } from "@/lib/profile/public-profile";

export default async function ProfilePreviewPage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const profile = await getPublicMemberProfile({
    ownedProfile: session.ownedProfile,
    profileId: session.ownedProfile.profile.id,
  });

  if (!profile) {
    redirect("/profile/edit");
  }

  return (
    <PublicProfileView
      backHref="/me"
      backLabel="Me"
      editHref="/profile/edit"
      profile={profile}
      titleLabel="Profile preview"
    />
  );
}
