import { redirect } from "next/navigation";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getFeatureFlags } from "@/lib/feature-flags";
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
  const featureFlags = getFeatureFlags();

  return (
    <UpgradePageClient
      boostPlans={boostPlanOptions}
      feature={featureFlags.premium}
      paymentsFeature={featureFlags.payments}
      initialStatus={status}
      premiumPlans={premiumPlanOptions}
    />
  );
}
