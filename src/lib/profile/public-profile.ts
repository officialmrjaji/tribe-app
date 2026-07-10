import {
  availabilityLabels,
  conversationStyleLabels,
  intentLabels,
  interestLabels,
  lifestyleSignalLabels,
  personalityTypeLabels,
  type Interest,
  type LifestyleSignal,
} from "@/lib/onboarding/options";
import {
  getOnboardingByProfileId,
  type OnboardingRecord,
} from "@/lib/onboarding/service";
import {
  getProfileVerification,
  type OwnedProfile,
  type ProfileVerification,
} from "@/lib/profile/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type PublicProfileRow = {
  avatar_url: string | null;
  bio: string | null;
  birthdate: string | null;
  city: string | null;
  country: string | null;
  discoverable: boolean;
  display_name: string | null;
  email_verified_at: string | null;
  has_active_boost?: boolean;
  id: string;
  identity_verified_at: string | null;
  is_premium?: boolean;
  last_seen_at?: string | null;
  onboarding_completed_at: string | null;
  phone_verified_at: string | null;
  region: string | null;
  social_pace: string | null;
  temperament_summary: string | null;
  user_id: string;
  verified_at: string | null;
  visibility: "discoverable" | "members" | "private";
  voice_intro_duration_seconds: number | null;
  voice_intro_url: string | null;
};

type PublicPhotoRow = {
  id: string;
  image_url: string;
};

type PublicPromptRow = {
  answer: string;
  id: string;
  prompt_text: string;
};

type PublicUserActivityRow = {
  last_seen_at: string | null;
};

export type PublicMemberProfile = {
  activityLabel: string;
  age: number | null;
  availability: string | null;
  bio: string | null;
  city: string;
  displayName: string;
  goals: string[];
  hasActiveBoost: boolean;
  id: string;
  interests: string[];
  isOwnProfile: boolean;
  isPremium: boolean;
  isRecentlyActive: boolean;
  languages: string[];
  lifestyleSignals: string[];
  personalitySummary: string | null;
  photos: Array<{
    id: string;
    imageUrl: string;
  }>;
  prompts: Array<{
    answer: string;
    id: string;
    promptText: string;
  }>;
  socialPace: string | null;
  userId: string;
  verification: ProfileVerification;
  voiceIntroDurationSeconds: number | null;
  voiceIntroUrl: string | null;
};

export async function getPublicMemberProfile({
  ownedProfile,
  profileId,
}: {
  ownedProfile: OwnedProfile;
  profileId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const publicProfile = profile as PublicProfileRow | null;

  if (!publicProfile) {
    return null;
  }

  const isOwnProfile = publicProfile.user_id === ownedProfile.account.id;

  if (!isOwnProfile && publicProfile.visibility === "private") {
    return null;
  }

  if (!isOwnProfile) {
    const blocked = await hasBlockedRelationship(
      ownedProfile.account.id,
      publicProfile.user_id,
    );

    if (blocked) {
      return null;
    }
  }

  const now = new Date().toISOString();
  const [
    photoResult,
    promptResult,
    subscriptionResult,
    boostResult,
    userActivityResult,
    onboarding,
  ] = await Promise.all([
      supabase
        .from("profile_photos")
        .select("id, image_url")
        .eq("profile_id", publicProfile.id)
        .order("is_primary", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(6),
      supabase
        .from("profile_prompts")
        .select("id, prompt_text, answer")
        .eq("profile_id", publicProfile.id)
        .order("sort_order", { ascending: true })
        .limit(6),
      supabase
        .from("premium_subscriptions")
        .select("id")
        .eq("user_id", publicProfile.user_id)
        .eq("status", "active")
        .gt("current_period_end", now)
        .limit(1),
      supabase
        .from("profile_boosts")
        .select("id")
        .eq("user_id", publicProfile.user_id)
        .eq("status", "active")
        .gt("expires_at", now)
        .limit(1),
      supabase
        .from("users")
        .select("last_seen_at")
        .eq("id", publicProfile.user_id)
        .maybeSingle(),
      getOnboardingByProfileId(publicProfile.id),
    ]);

  if (photoResult.error) {
    throw photoResult.error;
  }

  if (promptResult.error) {
    throw promptResult.error;
  }

  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  if (boostResult.error) {
    throw boostResult.error;
  }

  if (userActivityResult.error) {
    throw userActivityResult.error;
  }

  const userActivity = userActivityResult.data as PublicUserActivityRow | null;

  return formatPublicProfile({
    boostActive: (boostResult.data ?? []).length > 0,
    isOwnProfile,
    lastSeenAt: userActivity?.last_seen_at ?? null,
    onboarding,
    photos: (photoResult.data ?? []) as PublicPhotoRow[],
    premiumActive: (subscriptionResult.data ?? []).length > 0,
    profile: publicProfile,
    prompts: (promptResult.data ?? []) as PublicPromptRow[],
  });
}

async function hasBlockedRelationship(leftUserId: string, rightUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("blocked_users")
    .select("blocker_user_id, blocked_user_id")
    .or(
      `and(blocker_user_id.eq.${leftUserId},blocked_user_id.eq.${rightUserId}),and(blocker_user_id.eq.${rightUserId},blocked_user_id.eq.${leftUserId})`,
    )
    .limit(1);

  if (error) {
    throw error;
  }

  return (data ?? []).length > 0;
}

function formatPublicProfile({
  boostActive,
  isOwnProfile,
  lastSeenAt,
  onboarding,
  photos,
  premiumActive,
  profile,
  prompts,
}: {
  boostActive: boolean;
  isOwnProfile: boolean;
  lastSeenAt: string | null;
  onboarding: OnboardingRecord | null;
  photos: PublicPhotoRow[];
  premiumActive: boolean;
  profile: PublicProfileRow;
  prompts: PublicPromptRow[];
}): PublicMemberProfile {
  const activity = getActivityState(lastSeenAt);
  const imagePhotos = photos.map((photo) => ({
    id: photo.id,
    imageUrl: photo.image_url,
  }));

  return {
    activityLabel: activity.label,
    age: getAge(profile.birthdate),
    availability: onboarding
      ? availabilityLabels[onboarding.availability]
      : null,
    bio: profile.bio,
    city: formatLocation(profile),
    displayName: profile.display_name ?? "Tribe member",
    goals: onboarding ? buildGoals(onboarding) : [],
    hasActiveBoost: boostActive,
    id: profile.id,
    interests: onboarding
      ? onboarding.interests.slice(0, 12).map(labelInterest)
      : [],
    isOwnProfile,
    isPremium: premiumActive,
    isRecentlyActive: activity.isRecentlyActive,
    languages: onboarding ? buildLanguageSignals(onboarding) : [],
    lifestyleSignals: onboarding
      ? onboarding.lifestyle_signals.slice(0, 8).map(labelLifestyleSignal)
      : [],
    personalitySummary: buildPersonalitySummary(profile, onboarding),
    photos: imagePhotos.length
      ? imagePhotos
      : profile.avatar_url
        ? [{ id: "avatar", imageUrl: profile.avatar_url }]
        : [],
    prompts: prompts.map((prompt) => ({
      answer: prompt.answer,
      id: prompt.id,
      promptText: prompt.prompt_text,
    })),
    socialPace: profile.social_pace,
    userId: profile.user_id,
    verification: getProfileVerification(profile),
    voiceIntroDurationSeconds: profile.voice_intro_duration_seconds,
    voiceIntroUrl: profile.voice_intro_url,
  };
}

function buildGoals(onboarding: OnboardingRecord) {
  return Array.from(
    new Set([
      intentLabels[onboarding.intent],
      onboarding.primary_goal,
    ].filter(Boolean)),
  );
}

function buildPersonalitySummary(
  profile: PublicProfileRow,
  onboarding: OnboardingRecord | null,
) {
  if (profile.temperament_summary) {
    return profile.temperament_summary;
  }

  if (!onboarding) {
    return null;
  }

  return [
    personalityTypeLabels[onboarding.personality_type],
    conversationStyleLabels[onboarding.conversation_style],
    availabilityLabels[onboarding.availability],
  ].join(" / ");
}

function buildLanguageSignals(onboarding: OnboardingRecord) {
  const languages = new Set<string>();

  if (
    onboarding.intent === "language_exchange" ||
    onboarding.interests.includes("languages")
  ) {
    languages.add("Language exchange");
  }

  return Array.from(languages);
}

function getAge(birthdate: string | null) {
  if (!birthdate) {
    return null;
  }

  const birth = new Date(birthdate);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();

  if (
    monthDelta < 0 ||
    (monthDelta === 0 && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }

  return age >= 18 && age <= 120 ? age : null;
}

function getActivityState(lastSeenAt: string | null) {
  if (!lastSeenAt) {
    return {
      isRecentlyActive: false,
      label: "Activity pending",
    };
  }

  const lastSeen = new Date(lastSeenAt);

  if (Number.isNaN(lastSeen.getTime())) {
    return {
      isRecentlyActive: false,
      label: "Activity pending",
    };
  }

  const daysSince = Math.floor(
    (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSince <= 7) {
    return {
      isRecentlyActive: true,
      label: "Recently active",
    };
  }

  if (daysSince <= 30) {
    return {
      isRecentlyActive: false,
      label: "Active this month",
    };
  }

  return {
    isRecentlyActive: false,
    label: "Quiet lately",
  };
}

function formatLocation(profile: PublicProfileRow) {
  return [profile.city, profile.region, profile.country]
    .filter(Boolean)
    .join(", ") || "Location open";
}

function labelInterest(value: string) {
  return interestLabels[value as Interest] ?? toTitle(value);
}

function labelLifestyleSignal(value: string) {
  return lifestyleSignalLabels[value as LifestyleSignal] ?? toTitle(value);
}

function toTitle(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
