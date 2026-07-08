import { redirect } from "next/navigation";
import AICompanionClient from "./ai-companion-client";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getDiscoveryRecommendations } from "@/lib/discovery/service";
import { getFeatureFlag } from "@/lib/feature-flags";
import { listConversations } from "@/lib/messaging/service";
import { getOnboardingStatus } from "@/lib/onboarding/service";
import { getProfileQuality } from "@/lib/profile/service";

export default async function AICompanionPage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const aiFeature = getFeatureFlag("ai");

  if (!aiFeature.enabled) {
    return (
      <AICompanionClient
        conversations={[]}
        feature={aiFeature}
        matches={[]}
        onboarding={null}
        profile={{
          bio: "",
          displayName: session.ownedProfile.profile.display_name ?? "",
        }}
        prompts={[]}
      />
    );
  }

  const [quality, onboarding, discoveryResult, conversationsResult] =
    await Promise.all([
      getProfileQuality(session.ownedProfile),
      getOnboardingStatus(session.ownedProfile.profile.id),
      getDiscoveryRecommendations(session.ownedProfile).catch(() => null),
      listConversations(session.ownedProfile).catch(() => ({
        conversations: [],
      })),
    ]);

  return (
    <AICompanionClient
      conversations={conversationsResult.conversations}
      feature={aiFeature}
      matches={
        discoveryResult && discoveryResult.completed
          ? discoveryResult.profiles.slice(0, 12)
          : []
      }
      onboarding={onboarding.response}
      profile={{
        bio: session.ownedProfile.profile.bio ?? "",
        displayName: session.ownedProfile.profile.display_name ?? "",
      }}
      prompts={quality.prompts.map((prompt) => ({
        answer: prompt.answer,
        promptText: prompt.prompt_text,
      }))}
    />
  );
}
