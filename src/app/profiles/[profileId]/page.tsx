import { notFound, redirect } from "next/navigation";
import { PublicProfileView } from "@/components/profile/public-profile-view";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getPublicMemberProfile } from "@/lib/profile/public-profile";

export default async function PublicProfilePage(
  props: PageProps<"/profiles/[profileId]"> & {
    searchParams: Promise<{ from?: string }>;
  },
) {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const { profileId } = await props.params;
  const searchParams = await props.searchParams;
  const profile = await getPublicMemberProfile({
    ownedProfile: session.ownedProfile,
    profileId,
  });

  if (!profile) {
    notFound();
  }

  const fromPeople = searchParams.from === "people";

  return (
    <PublicProfileView
      backHref={fromPeople ? "/" : "/explore"}
      backLabel={fromPeople ? "People" : "Connections"}
      editHref={profile.isOwnProfile ? "/profile/edit" : undefined}
      profile={profile}
    />
  );
}
