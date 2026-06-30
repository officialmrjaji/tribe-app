import { redirect } from "next/navigation";
import { SquareFeed } from "@/components/square/square-feed";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { listSquareFeed } from "@/lib/square/service";

export default async function SquareTopicPage(props: PageProps<"/square/topics/[slug]">) {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const { slug } = await props.params;
  const feed = await listSquareFeed({
    ownedProfile: session.ownedProfile,
    topicSlug: slug,
  });

  return (
    <SquareFeed
      activeTopicSlug={slug}
      description="Topic pages collect related posts, questions, polls, and recommendations without creating separate communities yet."
      feed={feed}
      title={`Square topic: #${slug}`}
    />
  );
}
