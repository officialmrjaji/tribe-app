import type { OwnedProfile } from "@/lib/profile/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  Availability,
  ConversationStyle,
  Intent,
  Interest,
  LifestyleSignal,
  PersonalityType,
} from "./options";
import {
  availabilityLabels,
  conversationStyleLabels,
  interestLabels,
  personalityTypeLabels,
} from "./options";
import type { OnboardingInput } from "./schema";

export type OnboardingRecord = {
  availability: Availability;
  completed_at: string | null;
  conversation_style: ConversationStyle;
  created_at: string;
  id: string;
  intent: Intent;
  interests: Interest[];
  lifestyle_signals: LifestyleSignal[];
  personality_type: PersonalityType;
  primary_goal: string;
  profile_id: string;
  updated_at: string;
  user_id: string;
};

export type OnboardingSnapshot = OnboardingInput & {
  completedAt: string | null;
};

export type OnboardingStatus = {
  completed: boolean;
  response: OnboardingSnapshot | null;
};

function toSnapshot(record: OnboardingRecord): OnboardingSnapshot {
  return {
    availability: record.availability,
    completedAt: record.completed_at,
    conversationStyle: record.conversation_style,
    intent: record.intent,
    interests: record.interests,
    lifestyleSignals: record.lifestyle_signals,
    personalityType: record.personality_type,
    primaryGoal: record.primary_goal,
  };
}

export async function getOnboardingByProfileId(profileId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("onboarding_answers")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as OnboardingRecord | null) ?? null;
}

export async function getOnboardingStatus(
  profileId: string,
): Promise<OnboardingStatus> {
  const response = await getOnboardingByProfileId(profileId);

  if (!response) {
    return { completed: false, response: null };
  }

  return {
    completed: Boolean(response.completed_at),
    response: toSnapshot(response),
  };
}

export async function saveOnboardingResponse(
  ownedProfile: OwnedProfile,
  input: OnboardingInput,
) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: onboarding, error: onboardingError } = await supabase
    .from("onboarding_answers")
    .upsert(
      {
        availability: input.availability,
        completed_at: now,
        conversation_style: input.conversationStyle,
        intent: input.intent,
        interests: input.interests,
        lifestyle_signals: input.lifestyleSignals,
        personality_type: input.personalityType,
        primary_goal: input.primaryGoal,
        profile_id: ownedProfile.profile.id,
        updated_at: now,
        user_id: ownedProfile.account.id,
      },
      { onConflict: "profile_id" },
    )
    .select("*")
    .single();

  if (onboardingError || !onboarding) {
    throw onboardingError ?? new Error("Unable to save onboarding answers.");
  }

  const { error: preferencesError } = await supabase
    .from("profile_preferences")
    .upsert(
      {
        notification_settings: {
          onboardingCompletedAt: now,
        },
        preferred_pace: input.availability,
        profile_id: ownedProfile.profile.id,
        relationship_intents: [input.intent],
        updated_at: now,
      },
      { onConflict: "profile_id" },
    );

  if (preferencesError) {
    throw preferencesError;
  }

  const profileUpdates: {
    archetype: string;
    discoverable?: boolean;
    onboarding_completed_at: string;
    social_pace: string;
    temperament_summary: string;
    updated_at: string;
    visibility?: "discoverable";
  } = {
    archetype: personalityTypeLabels[input.personalityType],
    onboarding_completed_at: now,
    social_pace: availabilityLabels[input.availability],
    temperament_summary: conversationStyleLabels[input.conversationStyle],
    updated_at: now,
  };

  if (!ownedProfile.profile.onboarding_completed_at) {
    profileUpdates.discoverable = true;
    profileUpdates.visibility = "discoverable";
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdates)
    .eq("id", ownedProfile.profile.id)
    .eq("clerk_user_id", ownedProfile.account.clerk_user_id);

  if (profileError) {
    throw profileError;
  }

  await syncUserInterests(ownedProfile.account.id, input.interests);

  return toSnapshot(onboarding as OnboardingRecord);
}

async function syncUserInterests(userId: string, interests: Interest[]) {
  const supabase = createSupabaseAdminClient();
  const interestRows = interests.map((slug) => ({
    category: "onboarding",
    label: interestLabels[slug],
    slug,
  }));

  const { error: interestUpsertError } = await supabase
    .from("interests")
    .upsert(interestRows, { onConflict: "slug" });

  if (interestUpsertError) {
    throw interestUpsertError;
  }

  const { data: storedInterests, error: interestReadError } = await supabase
    .from("interests")
    .select("id, slug")
    .in("slug", interests);

  if (interestReadError) {
    throw interestReadError;
  }

  const { error: deleteError } = await supabase
    .from("user_interests")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw deleteError;
  }

  const userInterestRows = (storedInterests ?? []).map((interest) => ({
    interest_id: interest.id,
    user_id: userId,
    weight: 1,
  }));

  if (userInterestRows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("user_interests")
    .insert(userInterestRows);

  if (insertError) {
    throw insertError;
  }
}
