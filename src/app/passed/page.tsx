import { redirect } from "next/navigation";

export default function PassedProfilesPage() {
  redirect("/explore?tab=passed");
}
