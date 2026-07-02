import { redirect } from "next/navigation";

export default function SavedProfilesPage() {
  redirect("/explore?tab=liked");
}
