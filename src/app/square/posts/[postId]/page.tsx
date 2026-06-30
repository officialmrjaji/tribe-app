import { redirect } from "next/navigation";
import { SquareThread } from "@/components/square/square-thread";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getSquarePostThread } from "@/lib/square/service";

export default async function SquarePostPage(
  props: PageProps<"/square/posts/[postId]">,
) {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const { postId } = await props.params;
  const thread = await getSquarePostThread(session.ownedProfile, postId);

  return <SquareThread comments={thread.comments} post={thread.post} />;
}
