import { redirect } from "next/navigation";
import { SquareFeed } from "@/components/square/square-feed";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { listSquareFeed } from "@/lib/square/service";

export default async function SquarePage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const feed = await listSquareFeed({ ownedProfile: session.ownedProfile });

  return (
    <SquareFeed
      description="A community feed for thoughts, questions, recommendations, polls, and low-pressure context before direct connection."
      feed={feed}
      title="Square community feed"
    />
  );
}
