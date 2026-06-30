import { redirect } from "next/navigation";
import { SquareFeed } from "@/components/square/square-feed";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { listSquareFeed } from "@/lib/square/service";

export default async function SquareTrendingPage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const feed = await listSquareFeed({
    ownedProfile: session.ownedProfile,
    trendingOnly: true,
  });

  return (
    <SquareFeed
      description="Trending highlights useful recent discussions without turning Square into a popularity contest."
      feed={feed}
      title="Trending in Square"
    />
  );
}
