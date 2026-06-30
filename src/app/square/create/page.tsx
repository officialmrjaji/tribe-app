import { redirect } from "next/navigation";
import { SquareComposer } from "@/components/square/square-composer";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";

export default async function CreateSquarePostPage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  return <SquareComposer />;
}
