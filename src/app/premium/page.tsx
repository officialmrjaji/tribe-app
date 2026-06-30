import { redirect } from "next/navigation";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  boostPlanOptions,
  getPremiumStatus,
  premiumPlanOptions,
} from "@/lib/premium/service";
import UpgradePageClient from "./upgrade-client";

export default async function PremiumPage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const status = await getPremiumStatus(session.ownedProfile);

  return (
    <UpgradePageClient
      boostPlans={boostPlanOptions}
      initialStatus={status}
      premiumPlans={premiumPlanOptions}
    />
  );
}
