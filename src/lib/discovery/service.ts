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
  getOnboardingStatus,
  type OnboardingRecord,
} from "@/lib/onboarding/service";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { createNotification } from "@/lib/notifications/service";
import {
  assertOwnedProfileHasMinimumPhotos,
  assertProfileHasMinimumPhotos,
  getProfileVerification,
  minimumDiscoveryPhotoCount,
  type ProfileVerification,
  type OwnedProfile,
} from "@/lib/profile/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type ProfileRow = {
  archetype: string | null;
  avatar_url: string | null;
  bio: string | null;
  birthdate: string | null;
  city: string | null;
  clerk_user_id: string;
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
  photo_urls?: string[];
  profile_completion_score: number;
  profile_prompts?: ProfilePromptSummary[];
  region: string | null;
  social_pace: string | null;
  temperament_summary: string | null;
  user_id: string;
  verified_at: string | null;
  visibility: "private" | "members" | "discoverable";
  voice_intro_duration_seconds: number | null;
  voice_intro_url: string | null;
};

type InteractionProfile = {
  id: string;
  user_id: string;
};

type ProfileReference = {
  created_at: string;
  id: string;
  user_id: string;
};

type UserReference = {
  created_at: string;
  user_id: string;
};

type ProfilePhotoRow = {
  image_url: string;
  profile_id: string;
};

type ProfilePromptSummary = {
  answer: string;
  prompt: string;
};

type ProfilePromptRow = {
  answer: string;
  profile_id: string;
  prompt_text: string;
};

type UserActivityRow = {
  id: string;
  last_seen_at: string | null;
};

type ScoreBreakdown = {
  conversationStyle: number;
  interests: number;
  intent: number;
  lifestyle: number;
  personality: number;
};

export type DiscoveryProfile = {
  accent: string;
  activityLabel: string;
  age: number | null;
  archetype: string;
  availability: string;
  axes: {
    curiosity: number;
    depth: number;
    energy: number;
  };
  bio: string;
  circles: string[];
  city: string;
  id: string;
  image: string;
  hasActiveBoost: boolean;
  isRecentlyActive: boolean;
  isPremium: boolean;
  isSaved: boolean;
  isVerified: boolean;
  languages: string[];
  match: number;
  name: string;
  pace: string;
  personalitySummary: string;
  photos: string[];
  profileCompleteness: number;
  profilePrompts: ProfilePromptSummary[];
  prompts: string[];
  reasons: string[];
  scoreBreakdown: ScoreBreakdown;
  signal: string;
  sharedGoals: string[];
  sharedInterests: string[];
  temperament: string;
  traits: string[];
  userId: string;
  values: string[];
  verification: ProfileVerification;
  voiceIntroDurationSeconds: number | null;
  voiceIntroUrl: string | null;
};

export type DiscoveryCollectionProfile = DiscoveryProfile & {
  actedAt: string;
};

export type DiscoveryResult =
  | {
      completed: false;
      profiles: [];
      savedProfileIds: [];
    }
  | {
      completed: true;
      profiles: DiscoveryProfile[];
      savedProfileIds: string[];
    };

export type DiscoveryCollectionResult =
  | {
      completed: false;
      profiles: [];
    }
  | {
      completed: true;
      profiles: DiscoveryCollectionProfile[];
    };

type Recommendation = {
  profile: DiscoveryProfile;
  rawProfile: ProfileRow;
  reasons: string[];
  score: number;
};

const fallbackAvatars = [
  "/avatars/aya.png",
  "/avatars/milo.png",
  "/avatars/nora.png",
  "/avatars/jules.png",
  "/avatars/imani.png",
  "/avatars/ren.png",
] as const;

const algorithmVersion = "phase3_v1";

export async function getDiscoveryRecommendations(
  ownedProfile: OwnedProfile,
): Promise<DiscoveryResult> {
  const onboarding = await getOnboardingStatus(ownedProfile.profile.id);

  if (!onboarding.completed) {
    return { completed: false, profiles: [], savedProfileIds: [] };
  }

  const currentOnboarding = await getOnboardingByProfileId(
    ownedProfile.profile.id,
  );

  if (!currentOnboarding) {
    return { completed: false, profiles: [], savedProfileIds: [] };
  }

  const supabase = createSupabaseAdminClient();
  const [
    savedProfiles,
    passedProfiles,
    blockedByViewer,
    blockedViewer,
    candidateProfiles,
  ] = await Promise.all([
    fetchSavedProfiles(ownedProfile.account.id),
    fetchPassedProfiles(ownedProfile.account.id),
    fetchBlockedByViewer(ownedProfile.account.id),
    fetchBlockedViewer(ownedProfile.account.id),
    fetchCandidateProfiles(ownedProfile),
  ]);

  const savedProfileIds = savedProfiles.map((profile) => profile.id);
  const savedProfileIdSet = new Set(savedProfileIds);
  const passedProfileIds = new Set(passedProfiles.map((profile) => profile.id));
  const blockedUserIds = new Set([
    ...blockedByViewer.map((row) => row.blocked_user_id),
    ...blockedViewer.map((row) => row.blocker_user_id),
  ]);

  const candidates = candidateProfiles.filter(
    (profile) =>
      profile.user_id !== ownedProfile.account.id &&
      !passedProfileIds.has(profile.id) &&
      !blockedUserIds.has(profile.user_id) &&
      profile.onboarding_completed_at &&
      profile.profile_completion_score >= 80 &&
      (profile.photo_urls?.length ?? 0) >= minimumDiscoveryPhotoCount &&
      profile.discoverable &&
      profile.visibility !== "private",
  );

  if (candidates.length === 0) {
    return { completed: true, profiles: [], savedProfileIds };
  }

  const { data: onboardingRows, error: onboardingError } = await supabase
    .from("onboarding_answers")
    .select("*")
    .in(
      "profile_id",
      candidates.map((profile) => profile.id),
    )
    .not("completed_at", "is", null);

  if (onboardingError) {
    throw onboardingError;
  }

  const onboardingByProfileId = new Map(
    ((onboardingRows ?? []) as OnboardingRecord[]).map((row) => [
      row.profile_id,
      row,
    ]),
  );

  const recommendations = candidates
    .map((candidate, index) => {
      const candidateOnboarding = onboardingByProfileId.get(candidate.id);

      if (!candidateOnboarding) {
        return null;
      }

      return buildRecommendation({
        candidate,
        candidateOnboarding,
        currentOnboarding,
        index,
        isSaved: savedProfileIdSet.has(candidate.id),
        viewerProfile: ownedProfile.profile as ProfileRow,
      });
    })
    .filter((recommendation): recommendation is Recommendation =>
      Boolean(recommendation),
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, 24);

  await persistRecommendations(ownedProfile.account.id, recommendations);

  return {
    completed: true,
    profiles: recommendations.map((recommendation) => recommendation.profile),
    savedProfileIds,
  };
}

export async function getSavedDiscoveryProfiles(
  ownedProfile: OwnedProfile,
): Promise<DiscoveryCollectionResult> {
  const currentOnboarding = await getCompletedCurrentOnboarding(ownedProfile);

  if (!currentOnboarding) {
    return { completed: false, profiles: [] };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("saved_profiles")
    .select("saved_profile_id, saved_user_id, created_at")
    .eq("viewer_user_id", ownedProfile.account.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const references = ((data ?? []) as Array<{
    created_at: string;
    saved_profile_id: string;
    saved_user_id: string;
  }>).map((row) => ({
    created_at: row.created_at,
    id: row.saved_profile_id,
    user_id: row.saved_user_id,
  }));

  const profiles = await buildInteractionCollection({
    currentOnboarding,
    isSaved: true,
    ownedProfile,
    references,
  });

  return { completed: true, profiles };
}

export async function getLikedDiscoveryProfiles(
  ownedProfile: OwnedProfile,
): Promise<DiscoveryCollectionResult> {
  return getSavedDiscoveryProfiles(ownedProfile);
}

export async function getInboundLikedDiscoveryProfiles(
  ownedProfile: OwnedProfile,
): Promise<DiscoveryCollectionResult> {
  const currentOnboarding = await getCompletedCurrentOnboarding(ownedProfile);

  if (!currentOnboarding) {
    return { completed: false, profiles: [] };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("saved_profiles")
    .select("viewer_user_id, created_at")
    .eq("saved_user_id", ownedProfile.account.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const references = await buildProfileReferencesFromUserReferences(
    ((data ?? []) as Array<{
      created_at: string;
      viewer_user_id: string;
    }>).map((row) => ({
      created_at: row.created_at,
      user_id: row.viewer_user_id,
    })),
  );

  const profiles = await buildInteractionCollection({
    currentOnboarding,
    isSaved: false,
    ownedProfile,
    references,
  });

  return { completed: true, profiles };
}

export async function getInboundLikedProfileCount(ownedProfile: OwnedProfile) {
  const currentOnboarding = await getCompletedCurrentOnboarding(ownedProfile);

  if (!currentOnboarding) {
    return 0;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("saved_profiles")
    .select("viewer_user_id, created_at")
    .eq("saved_user_id", ownedProfile.account.id);

  if (error) {
    throw error;
  }

  const references = await buildProfileReferencesFromUserReferences(
    ((data ?? []) as Array<{
      created_at: string;
      viewer_user_id: string;
    }>).map((row) => ({
      created_at: row.created_at,
      user_id: row.viewer_user_id,
    })),
  );

  const profiles = await buildInteractionCollection({
    currentOnboarding,
    isSaved: false,
    ownedProfile,
    references,
  });

  return profiles.length;
}

export async function getMutualLikedDiscoveryProfiles(
  ownedProfile: OwnedProfile,
): Promise<DiscoveryCollectionResult> {
  const currentOnboarding = await getCompletedCurrentOnboarding(ownedProfile);

  if (!currentOnboarding) {
    return { completed: false, profiles: [] };
  }

  const supabase = createSupabaseAdminClient();
  const [outgoingResult, incomingResult] = await Promise.all([
    supabase
      .from("saved_profiles")
      .select("saved_profile_id, saved_user_id, created_at")
      .eq("viewer_user_id", ownedProfile.account.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_profiles")
      .select("viewer_user_id, created_at")
      .eq("saved_user_id", ownedProfile.account.id),
  ]);

  if (outgoingResult.error) {
    throw outgoingResult.error;
  }

  if (incomingResult.error) {
    throw incomingResult.error;
  }

  const incomingByUserId = new Map(
    ((incomingResult.data ?? []) as Array<{
      created_at: string;
      viewer_user_id: string;
    }>).map((row) => [row.viewer_user_id, row.created_at]),
  );

  const references = ((outgoingResult.data ?? []) as Array<{
    created_at: string;
    saved_profile_id: string;
    saved_user_id: string;
  }>)
    .filter((row) => incomingByUserId.has(row.saved_user_id))
    .map((row) => ({
      created_at: latestTimestamp(
        row.created_at,
        incomingByUserId.get(row.saved_user_id),
      ),
      id: row.saved_profile_id,
      user_id: row.saved_user_id,
    }));

  const profiles = await buildInteractionCollection({
    currentOnboarding,
    isSaved: true,
    ownedProfile,
    references,
  });

  return { completed: true, profiles };
}

export async function getPassedDiscoveryProfiles(
  ownedProfile: OwnedProfile,
): Promise<DiscoveryCollectionResult> {
  const currentOnboarding = await getCompletedCurrentOnboarding(ownedProfile);

  if (!currentOnboarding) {
    return { completed: false, profiles: [] };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("passed_profiles")
    .select("passed_profile_id, passed_user_id, created_at")
    .eq("viewer_user_id", ownedProfile.account.id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const references = ((data ?? []) as Array<{
    created_at: string;
    passed_profile_id: string;
    passed_user_id: string;
  }>).map((row) => ({
    created_at: row.created_at,
    id: row.passed_profile_id,
    user_id: row.passed_user_id,
  }));

  const profiles = await buildInteractionCollection({
    currentOnboarding,
    isSaved: false,
    ownedProfile,
    references,
  });

  return { completed: true, profiles };
}

export async function saveDiscoveryProfile(
  ownedProfile: OwnedProfile,
  profileId: string,
) {
  await assertOwnedProfileHasMinimumPhotos(ownedProfile);

  const target = await getTargetProfile(ownedProfile, profileId);

  await assertProfileHasMinimumPhotos(target.id);

  const supabase = createSupabaseAdminClient();

  const { error: saveError } = await supabase.from("saved_profiles").upsert(
    {
      saved_profile_id: target.id,
      saved_user_id: target.user_id,
      viewer_user_id: ownedProfile.account.id,
    },
    { onConflict: "viewer_user_id,saved_user_id" },
  );

  if (saveError) {
    throw saveError;
  }

  await supabase
    .from("passed_profiles")
    .delete()
    .eq("viewer_user_id", ownedProfile.account.id)
    .eq("passed_user_id", target.user_id);

  await createProfileSaveNotifications(ownedProfile, target);

  return { liked: true, profileId: target.id, saved: true };
}

export async function passDiscoveryProfile(
  ownedProfile: OwnedProfile,
  profileId: string,
) {
  const target = await getTargetProfile(ownedProfile, profileId);
  const supabase = createSupabaseAdminClient();

  const { error: passError } = await supabase.from("passed_profiles").upsert(
    {
      passed_profile_id: target.id,
      passed_user_id: target.user_id,
      viewer_user_id: ownedProfile.account.id,
    },
    { onConflict: "viewer_user_id,passed_user_id" },
  );

  if (passError) {
    throw passError;
  }

  await supabase
    .from("saved_profiles")
    .delete()
    .eq("viewer_user_id", ownedProfile.account.id)
    .eq("saved_user_id", target.user_id);

  return { passed: true, profileId: target.id };
}

export async function undoLastPassedProfile(ownedProfile: OwnedProfile) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("passed_profiles")
    .select("passed_profile_id, passed_user_id")
    .eq("viewer_user_id", ownedProfile.account.id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const lastPass = data as {
    passed_profile_id: string;
    passed_user_id: string;
  } | null;

  if (!lastPass) {
    return { profileId: null, undone: false };
  }

  const { error: deleteError } = await supabase
    .from("passed_profiles")
    .delete()
    .eq("viewer_user_id", ownedProfile.account.id)
    .eq("passed_user_id", lastPass.passed_user_id);

  if (deleteError) {
    throw deleteError;
  }

  return { profileId: lastPass.passed_profile_id, undone: true };
}

export async function restorePassedProfile(
  ownedProfile: OwnedProfile,
  profileId: string,
) {
  const target = await getTargetProfile(ownedProfile, profileId);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("passed_profiles")
    .delete()
    .eq("viewer_user_id", ownedProfile.account.id)
    .eq("passed_user_id", target.user_id)
    .select("passed_profile_id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    profileId: target.id,
    restored: Boolean(data),
  };
}

export async function blockDiscoveryProfile(
  ownedProfile: OwnedProfile,
  profileId: string,
  reason?: string,
) {
  const target = await getTargetProfile(ownedProfile, profileId);
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("blocked_users").upsert(
    {
      blocked_user_id: target.user_id,
      blocker_user_id: ownedProfile.account.id,
      reason: reason ?? null,
    },
    { onConflict: "blocker_user_id,blocked_user_id" },
  );

  if (error) {
    throw error;
  }

  await Promise.all([
    supabase
      .from("saved_profiles")
      .delete()
      .eq("viewer_user_id", ownedProfile.account.id)
      .eq("saved_user_id", target.user_id),
    supabase
      .from("passed_profiles")
      .delete()
      .eq("viewer_user_id", ownedProfile.account.id)
      .eq("passed_user_id", target.user_id),
  ]);

  return { blocked: true, profileId: target.id };
}

export async function reportDiscoveryProfile({
  details,
  ownedProfile,
  profileId,
  reason,
}: {
  details?: string;
  ownedProfile: OwnedProfile;
  profileId: string;
  reason: string;
}) {
  const target = await getTargetProfile(ownedProfile, profileId);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("reports")
    .insert({
      details: details ?? null,
      reason,
      reported_profile_id: target.id,
      reported_user_id: target.user_id,
      reporter_user_id: ownedProfile.account.id,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return { reportId: data.id };
}

async function fetchCandidateProfiles(ownedProfile: OwnedProfile) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("user_id", ownedProfile.account.id)
    .not("onboarding_completed_at", "is", null)
    .gte("profile_completion_score", 80)
    .eq("discoverable", true)
    .neq("visibility", "private")
    .limit(100);

  if (error) {
    throw error;
  }

  return hydrateProfileQualityDetails((data ?? []) as ProfileRow[]);
}

async function hydrateProfileQualityDetails(profiles: ProfileRow[]) {
  if (profiles.length === 0) {
    return profiles;
  }

  const supabase = createSupabaseAdminClient();
  const profileIds = profiles.map((profile) => profile.id);
  const userIds = profiles.map((profile) => profile.user_id);
  const now = new Date().toISOString();
  const [
    photoResult,
    promptResult,
    activityResult,
    subscriptionResult,
    boostResult,
  ] = await Promise.all([
    supabase
      .from("profile_photos")
      .select("profile_id, image_url")
      .in("profile_id", profileIds)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("profile_prompts")
      .select("profile_id, prompt_text, answer")
      .in("profile_id", profileIds)
      .order("sort_order", { ascending: true }),
    supabase
      .from("users")
      .select("id, last_seen_at")
      .in("id", userIds),
    supabase
      .from("premium_subscriptions")
      .select("user_id")
      .in("user_id", userIds)
      .eq("status", "active")
      .gt("current_period_end", now),
    supabase
      .from("profile_boosts")
      .select("user_id")
      .in("user_id", userIds)
      .eq("status", "active")
      .gt("expires_at", now),
  ]);

  if (photoResult.error) {
    throw photoResult.error;
  }

  if (promptResult.error) {
    throw promptResult.error;
  }

  if (activityResult.error) {
    throw activityResult.error;
  }

  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  if (boostResult.error) {
    throw boostResult.error;
  }

  const photosByProfileId = new Map<string, string[]>();
  ((photoResult.data ?? []) as ProfilePhotoRow[]).forEach((photo) => {
    const photos = photosByProfileId.get(photo.profile_id) ?? [];
    photos.push(photo.image_url);
    photosByProfileId.set(photo.profile_id, photos);
  });

  const promptsByProfileId = new Map<string, ProfilePromptSummary[]>();
  ((promptResult.data ?? []) as ProfilePromptRow[]).forEach((prompt) => {
    const prompts = promptsByProfileId.get(prompt.profile_id) ?? [];
    prompts.push({
      answer: prompt.answer,
      prompt: prompt.prompt_text,
    });
    promptsByProfileId.set(prompt.profile_id, prompts);
  });

  const activityByUserId = new Map(
    ((activityResult.data ?? []) as UserActivityRow[]).map((row) => [
      row.id,
      row.last_seen_at,
    ]),
  );
  const premiumUserIds = new Set(
    ((subscriptionResult.data ?? []) as Array<{ user_id: string }>).map(
      (row) => row.user_id,
    ),
  );
  const boostedUserIds = new Set(
    ((boostResult.data ?? []) as Array<{ user_id: string }>).map(
      (row) => row.user_id,
    ),
  );

  return profiles.map((profile) => ({
    ...profile,
    has_active_boost: boostedUserIds.has(profile.user_id),
    is_premium: premiumUserIds.has(profile.user_id),
    last_seen_at: activityByUserId.get(profile.user_id) ?? null,
    photo_urls: photosByProfileId.get(profile.id) ?? [],
    profile_prompts: promptsByProfileId.get(profile.id) ?? [],
  }));
}

async function fetchSavedProfiles(viewerUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("saved_profiles")
    .select("saved_profile_id, saved_user_id")
    .eq("viewer_user_id", viewerUserId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    saved_profile_id: string;
    saved_user_id: string;
  }>).map((row) => ({
    id: row.saved_profile_id,
    user_id: row.saved_user_id,
  }));
}

async function fetchPassedProfiles(viewerUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("passed_profiles")
    .select("passed_profile_id, passed_user_id")
    .eq("viewer_user_id", viewerUserId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    passed_profile_id: string;
    passed_user_id: string;
  }>).map((row) => ({
    id: row.passed_profile_id,
    user_id: row.passed_user_id,
  }));
}

async function fetchBlockedByViewer(viewerUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("blocked_users")
    .select("blocked_user_id")
    .eq("blocker_user_id", viewerUserId);

  if (error) {
    throw error;
  }

  return (data ?? []) as Array<{ blocked_user_id: string }>;
}

async function fetchBlockedViewer(viewerUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("blocked_users")
    .select("blocker_user_id")
    .eq("blocked_user_id", viewerUserId);

  if (error) {
    throw error;
  }

  return (data ?? []) as Array<{ blocker_user_id: string }>;
}

async function getCompletedCurrentOnboarding(ownedProfile: OwnedProfile) {
  const onboarding = await getOnboardingStatus(ownedProfile.profile.id);

  if (!onboarding.completed) {
    return null;
  }

  return getOnboardingByProfileId(ownedProfile.profile.id);
}

async function buildInteractionCollection({
  currentOnboarding,
  isSaved,
  ownedProfile,
  references,
}: {
  currentOnboarding: OnboardingRecord;
  isSaved: boolean;
  ownedProfile: OwnedProfile;
  references: ProfileReference[];
}) {
  if (references.length === 0) {
    return [];
  }

  const [blockedByViewer, blockedViewer] = await Promise.all([
    fetchBlockedByViewer(ownedProfile.account.id),
    fetchBlockedViewer(ownedProfile.account.id),
  ]);
  const blockedUserIds = new Set([
    ...blockedByViewer.map((row) => row.blocked_user_id),
    ...blockedViewer.map((row) => row.blocker_user_id),
  ]);
  const visibleReferences = references.filter(
    (reference) =>
      reference.user_id !== ownedProfile.account.id &&
      !blockedUserIds.has(reference.user_id),
  );

  if (visibleReferences.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const profileIds = visibleReferences.map((reference) => reference.id);
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .in("id", profileIds)
    .neq("user_id", ownedProfile.account.id)
    .not("onboarding_completed_at", "is", null)
    .neq("visibility", "private");

  if (profileError) {
    throw profileError;
  }

  const profiles = await hydrateProfileQualityDetails(
    (profileRows ?? []) as ProfileRow[],
  );

  if (profiles.length === 0) {
    return [];
  }

  const { data: onboardingRows, error: onboardingError } = await supabase
    .from("onboarding_answers")
    .select("*")
    .in(
      "profile_id",
      profiles.map((profile) => profile.id),
    )
    .not("completed_at", "is", null);

  if (onboardingError) {
    throw onboardingError;
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const onboardingByProfileId = new Map(
    ((onboardingRows ?? []) as OnboardingRecord[]).map((row) => [
      row.profile_id,
      row,
    ]),
  );

  return visibleReferences
    .map((reference, index) => {
      const candidate = profilesById.get(reference.id);
      const candidateOnboarding = onboardingByProfileId.get(reference.id);

      if (!candidate || !candidateOnboarding) {
        return null;
      }

      const recommendation = buildRecommendation({
        candidate,
        candidateOnboarding,
        currentOnboarding,
        index,
        isSaved,
        viewerProfile: ownedProfile.profile as ProfileRow,
      });

      return {
        ...recommendation.profile,
        actedAt: reference.created_at,
      };
    })
    .filter(
      (profile): profile is DiscoveryCollectionProfile => profile !== null,
    );
}

async function buildProfileReferencesFromUserReferences(
  userReferences: UserReference[],
) {
  if (userReferences.length === 0) {
    return [];
  }

  const latestByUserId = new Map<string, UserReference>();

  userReferences.forEach((reference) => {
    const existing = latestByUserId.get(reference.user_id);

    if (
      !existing ||
      new Date(reference.created_at).getTime() >
        new Date(existing.created_at).getTime()
    ) {
      latestByUserId.set(reference.user_id, reference);
    }
  });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id")
    .in("user_id", Array.from(latestByUserId.keys()))
    .not("onboarding_completed_at", "is", null)
    .neq("visibility", "private");

  if (error) {
    throw error;
  }

  const profileByUserId = new Map(
    ((data ?? []) as Array<{ id: string; user_id: string }>).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );

  return Array.from(latestByUserId.values())
    .map((reference) => {
      const profile = profileByUserId.get(reference.user_id);

      if (!profile) {
        return null;
      }

      return {
        created_at: reference.created_at,
        id: profile.id,
        user_id: profile.user_id,
      };
    })
    .filter((reference): reference is ProfileReference => reference !== null);
}

function latestTimestamp(left: string, right?: string) {
  if (!right) {
    return left;
  }

  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

async function getTargetProfile(ownedProfile: OwnedProfile, profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const target = data as InteractionProfile | null;

  if (!target) {
    throw new Error("Profile not found.");
  }

  if (target.user_id === ownedProfile.account.id) {
    throw new Error("Cannot interact with your own profile.");
  }

  return target;
}

async function createProfileSaveNotifications(
  ownedProfile: OwnedProfile,
  target: InteractionProfile,
) {
  const supabase = createSupabaseAdminClient();

  await createNotification({
    actorUserId: ownedProfile.account.id,
    data: {
      profileId: ownedProfile.profile.id,
      savedProfileId: target.id,
    },
    dedupeKey: `profile_saved:${ownedProfile.account.id}:${target.user_id}`,
    entityId: ownedProfile.profile.id,
    entityType: "profile",
    recipientUserId: target.user_id,
    type: "profile_saved",
  });

  const { data: reciprocalSave, error } = await supabase
    .from("saved_profiles")
    .select("saved_user_id")
    .eq("viewer_user_id", target.user_id)
    .eq("saved_user_id", ownedProfile.account.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!reciprocalSave) {
    return;
  }

  const pairKey = [ownedProfile.account.id, target.user_id].sort().join(":");

  await Promise.all([
    trackAnalyticsEvent({
      eventType: "match_created",
      ownedProfile,
      properties: {
        matchedProfileId: target.id,
        matchedUserId: target.user_id,
      },
    }),
    createNotification({
      actorUserId: target.user_id,
      data: {
        profileId: target.id,
      },
      dedupeKey: `mutual_save:${pairKey}:${ownedProfile.account.id}`,
      entityId: target.id,
      entityType: "match",
      recipientUserId: ownedProfile.account.id,
      type: "mutual_save",
    }),
    createNotification({
      actorUserId: ownedProfile.account.id,
      data: {
        profileId: ownedProfile.profile.id,
      },
      dedupeKey: `mutual_save:${pairKey}:${target.user_id}`,
      entityId: ownedProfile.profile.id,
      entityType: "match",
      recipientUserId: target.user_id,
      type: "mutual_save",
    }),
  ]);
}

function buildRecommendation({
  candidate,
  candidateOnboarding,
  currentOnboarding,
  index,
  isSaved,
  viewerProfile,
}: {
  candidate: ProfileRow;
  candidateOnboarding: OnboardingRecord;
  currentOnboarding: OnboardingRecord;
  index: number;
  isSaved: boolean;
  viewerProfile: ProfileRow;
}): Recommendation {
  const commonInterests = intersection(
    currentOnboarding.interests,
    candidateOnboarding.interests,
  );
  const commonLifestyleSignals = intersection(
    currentOnboarding.lifestyle_signals,
    candidateOnboarding.lifestyle_signals,
  );
  const sameCity =
    Boolean(viewerProfile.city) &&
    Boolean(candidate.city) &&
    normalize(viewerProfile.city) === normalize(candidate.city);
  const sameIntent = currentOnboarding.intent === candidateOnboarding.intent;
  const sameConversationStyle =
    currentOnboarding.conversation_style ===
    candidateOnboarding.conversation_style;
  const sameAvailability =
    currentOnboarding.availability === candidateOnboarding.availability;
  const personalityFit =
    currentOnboarding.personality_type === candidateOnboarding.personality_type
      ? 6
      : currentOnboarding.personality_type === "ambivert" ||
          candidateOnboarding.personality_type === "ambivert"
        ? 4
        : 2;
  const scoreBreakdown = buildScoreBreakdown({
    candidateOnboarding,
    commonInterests,
    commonLifestyleSignals,
    currentOnboarding,
    sameConversationStyle,
    sameIntent,
  });

  const score = clampScore(
    48 +
      (sameCity ? 14 : 0) +
      (sameIntent ? 16 : 4) +
      Math.min(commonInterests.length * 5, 20) +
      Math.min(commonLifestyleSignals.length * 4, 16) +
      (sameConversationStyle ? 11 : 0) +
      (sameAvailability ? 9 : 0) +
      personalityFit +
      (candidate.has_active_boost ? 6 : 0),
  );
  const reasons = buildReasons({
    candidate,
    candidateOnboarding,
    commonInterests,
    commonLifestyleSignals,
    sameAvailability,
    sameCity,
    sameConversationStyle,
    sameIntent,
  });
  const traits = buildTraits({
    candidateOnboarding,
    commonInterests,
    commonLifestyleSignals,
    sameCity,
    sameIntent,
  });
  const values = commonLifestyleSignals.length
    ? commonLifestyleSignals.map(labelLifestyleSignal)
    : candidateOnboarding.lifestyle_signals.slice(0, 3).map(labelLifestyleSignal);
  const circles = commonInterests.length
    ? commonInterests.map(labelInterest)
    : candidateOnboarding.interests.slice(0, 3).map(labelInterest);
  const storedPhotos = candidate.photo_urls ?? [];
  const photoUrls = storedPhotos.length
    ? storedPhotos
    : candidate.avatar_url
      ? [candidate.avatar_url]
      : [];
  const image =
    photoUrls[0] ?? fallbackAvatars[index % fallbackAvatars.length];
  const activity = getActivityState(candidate.last_seen_at ?? null);
  const profilePrompts = (candidate.profile_prompts ?? []).slice(0, 3);
  const verification = getProfileVerification(candidate);
  const sharedInterests = commonInterests.map(labelInterest);
  const sharedGoals = sameIntent
    ? [intentLabels[candidateOnboarding.intent]]
    : [candidateOnboarding.primary_goal];
  const languages = buildLanguageSignals(candidateOnboarding);
  const personalitySummary = [
    personalityTypeLabels[candidateOnboarding.personality_type],
    conversationStyleLabels[candidateOnboarding.conversation_style],
    availabilityLabels[candidateOnboarding.availability],
  ].join(" / ");

  return {
    profile: {
      accent: getAccent(score, index),
      activityLabel: activity.label,
      age: getAge(candidate.birthdate),
      archetype:
        candidate.archetype ??
        personalityTypeLabels[candidateOnboarding.personality_type],
      availability: availabilityLabels[candidateOnboarding.availability],
      axes: buildAxes({
        commonInterests,
        commonLifestyleSignals,
        candidateOnboarding,
        sameAvailability,
        sameConversationStyle,
      }),
      bio: candidate.bio ?? candidateOnboarding.primary_goal,
      circles: ensureAtLeast(circles, ["Shared intent", "Local discovery"]),
      city: formatLocation(candidate),
      id: candidate.id,
      image,
      hasActiveBoost: Boolean(candidate.has_active_boost),
      isRecentlyActive: activity.isRecentlyActive,
      isPremium: Boolean(candidate.is_premium),
      isSaved,
      isVerified:
        verification.email || verification.phone || verification.identity,
      languages,
      match: score,
      name: candidate.display_name ?? "Tribe member",
      pace:
        candidate.social_pace ??
        availabilityLabels[candidateOnboarding.availability],
      personalitySummary,
      photos: photoUrls.length ? photoUrls : [image],
      profileCompleteness: candidate.profile_completion_score,
      profilePrompts,
      prompts: ensureAtLeast(reasons, [
        "Ask what they are hoping to make more room for.",
        "Compare a low-pressure plan that fits both of your schedules.",
        "Start with the shared interest that feels easiest.",
      ]).slice(0, 3),
      reasons,
      scoreBreakdown,
      signal: reasons[0] ?? candidateOnboarding.primary_goal,
      sharedGoals,
      sharedInterests,
      temperament:
        candidate.temperament_summary ??
        conversationStyleLabels[candidateOnboarding.conversation_style],
      traits,
      userId: candidate.user_id,
      values: ensureAtLeast(values, [
        intentLabels[candidateOnboarding.intent].toLowerCase(),
      ]),
      verification,
      voiceIntroDurationSeconds: candidate.voice_intro_duration_seconds,
      voiceIntroUrl: candidate.voice_intro_url,
    },
    rawProfile: candidate,
    reasons,
    score,
  };
}

function buildReasons({
  candidate,
  candidateOnboarding,
  commonInterests,
  commonLifestyleSignals,
  sameAvailability,
  sameCity,
  sameConversationStyle,
  sameIntent,
}: {
  candidate: ProfileRow;
  candidateOnboarding: OnboardingRecord;
  commonInterests: Interest[];
  commonLifestyleSignals: LifestyleSignal[];
  sameAvailability: boolean;
  sameCity: boolean;
  sameConversationStyle: boolean;
  sameIntent: boolean;
}) {
  const reasons: string[] = [];

  if (sameCity && candidate.city) {
    reasons.push(`Both of you are rooted around ${candidate.city}.`);
  }

  if (sameIntent) {
    reasons.push(
      `You are both looking for ${intentLabels[
        candidateOnboarding.intent
      ].toLowerCase()}.`,
    );
  }

  if (commonInterests.length) {
    reasons.push(
      `Shared interests: ${commonInterests
        .slice(0, 3)
        .map(labelInterest)
        .join(", ")}.`,
    );
  }

  if (commonLifestyleSignals.length) {
    reasons.push(
      `Lifestyle overlap around ${commonLifestyleSignals
        .slice(0, 2)
        .map(labelLifestyleSignal)
        .join(" and ")}.`,
    );
  }

  if (sameConversationStyle) {
    reasons.push(
      `Your conversation styles both lean ${conversationStyleLabels[
        candidateOnboarding.conversation_style
      ].toLowerCase()}.`,
    );
  }

  if (sameAvailability) {
    reasons.push(
      `Your availability both points to ${availabilityLabels[
        candidateOnboarding.availability
      ].toLowerCase()}.`,
    );
  }

  if (reasons.length === 0) {
    reasons.push("Their onboarding signals give enough texture for a first plan.");
  }

  return reasons;
}

function buildTraits({
  candidateOnboarding,
  commonInterests,
  commonLifestyleSignals,
  sameCity,
  sameIntent,
}: {
  candidateOnboarding: OnboardingRecord;
  commonInterests: Interest[];
  commonLifestyleSignals: LifestyleSignal[];
  sameCity: boolean;
  sameIntent: boolean;
}) {
  const traits = new Set<string>();

  if (sameCity) {
    traits.add("Local");
  }

  if (commonInterests.length) {
    traits.add("Curious");
  }

  if (
    commonLifestyleSignals.includes("creative") ||
    candidateOnboarding.lifestyle_signals.includes("creative")
  ) {
    traits.add("Creative");
  }

  if (
    commonLifestyleSignals.some((signal) =>
      ["community", "low_key", "wellness"].includes(signal),
    )
  ) {
    traits.add("Grounded");
  }

  if (sameIntent) {
    traits.add(intentLabels[candidateOnboarding.intent]);
  }

  traits.add(personalityTypeLabels[candidateOnboarding.personality_type]);

  return Array.from(traits).slice(0, 5);
}

function buildAxes({
  candidateOnboarding,
  commonInterests,
  commonLifestyleSignals,
  sameAvailability,
  sameConversationStyle,
}: {
  candidateOnboarding: OnboardingRecord;
  commonInterests: Interest[];
  commonLifestyleSignals: LifestyleSignal[];
  sameAvailability: boolean;
  sameConversationStyle: boolean;
}) {
  const depth =
    58 +
    (sameConversationStyle ? 18 : 0) +
    (candidateOnboarding.conversation_style === "deep_dives" ? 12 : 0) +
    Math.min(commonInterests.length * 4, 16);
  const energy =
    54 +
    (candidateOnboarding.personality_type === "extrovert" ? 18 : 0) +
    (candidateOnboarding.personality_type === "ambivert" ? 10 : 0) +
    (sameAvailability ? 12 : 0);
  const curiosity =
    60 +
    Math.min(commonInterests.length * 6, 20) +
    Math.min(commonLifestyleSignals.length * 4, 16);

  return {
    curiosity: clampAxis(curiosity),
    depth: clampAxis(depth),
    energy: clampAxis(energy),
  };
}

function buildScoreBreakdown({
  candidateOnboarding,
  commonInterests,
  commonLifestyleSignals,
  currentOnboarding,
  sameConversationStyle,
  sameIntent,
}: {
  candidateOnboarding: OnboardingRecord;
  commonInterests: Interest[];
  commonLifestyleSignals: LifestyleSignal[];
  currentOnboarding: OnboardingRecord;
  sameConversationStyle: boolean;
  sameIntent: boolean;
}): ScoreBreakdown {
  const personality =
    currentOnboarding.personality_type === candidateOnboarding.personality_type
      ? 100
      : currentOnboarding.personality_type === "ambivert" ||
          candidateOnboarding.personality_type === "ambivert"
        ? 75
        : 45;

  return {
    conversationStyle: sameConversationStyle ? 100 : 55,
    interests: clampBreakdown(commonInterests.length * 34),
    intent: sameIntent ? 100 : 45,
    lifestyle: clampBreakdown(commonLifestyleSignals.length * 34),
    personality,
  };
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

async function persistRecommendations(
  viewerUserId: string,
  recommendations: Recommendation[],
) {
  if (recommendations.length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const rows = recommendations.map((recommendation) => ({
    algorithm_version: algorithmVersion,
    candidate_profile_id: recommendation.rawProfile.id,
    candidate_user_id: recommendation.rawProfile.user_id,
    generated_at: now,
    reasons: recommendation.reasons,
    score: recommendation.score,
    updated_at: now,
    viewer_user_id: viewerUserId,
  }));
  const { error } = await supabase
    .from("recommendations")
    .upsert(rows, { onConflict: "viewer_user_id,candidate_user_id" });

  if (error) {
    throw error;
  }
}

function intersection<T extends string>(left: T[], right: T[]) {
  const rightSet = new Set(right);

  return left.filter((value) => rightSet.has(value));
}

function normalize(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function clampScore(value: number) {
  return Math.max(54, Math.min(99, Math.round(value)));
}

function clampAxis(value: number) {
  return Math.max(35, Math.min(98, Math.round(value)));
}

function clampBreakdown(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
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

function formatLocation(profile: ProfileRow) {
  return [profile.city, profile.region, profile.country]
    .filter(Boolean)
    .join(", ") || "Location open";
}

function getAccent(score: number, index: number) {
  if (score >= 92) {
    return "bg-[#f6c66f]";
  }

  if (score >= 84) {
    return "bg-[#94c973]";
  }

  return ["bg-[#8ac5c1]", "bg-[#ef8f7a]"][index % 2];
}

function ensureAtLeast(values: string[], fallback: string[]) {
  return values.length ? values : fallback;
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
