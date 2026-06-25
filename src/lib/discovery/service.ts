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
import type { OwnedProfile } from "@/lib/profile/service";
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
  id: string;
  onboarding_completed_at: string | null;
  region: string | null;
  social_pace: string | null;
  temperament_summary: string | null;
  user_id: string;
  visibility: "private" | "members" | "discoverable";
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

export type DiscoveryProfile = {
  accent: string;
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
  isSaved: boolean;
  match: number;
  name: string;
  pace: string;
  prompts: string[];
  reasons: string[];
  signal: string;
  temperament: string;
  traits: string[];
  userId: string;
  values: string[];
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
  const target = await getTargetProfile(ownedProfile, profileId);
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

  return { profileId: target.id, saved: true };
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
    .eq("discoverable", true)
    .neq("visibility", "private")
    .limit(100);

  if (error) {
    throw error;
  }

  return (data ?? []) as ProfileRow[];
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

  const supabase = createSupabaseAdminClient();
  const profileIds = references.map((reference) => reference.id);
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

  const profiles = (profileRows ?? []) as ProfileRow[];

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

  return references
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

  const score = clampScore(
    48 +
      (sameCity ? 14 : 0) +
      (sameIntent ? 16 : 4) +
      Math.min(commonInterests.length * 5, 20) +
      Math.min(commonLifestyleSignals.length * 4, 16) +
      (sameConversationStyle ? 11 : 0) +
      (sameAvailability ? 9 : 0) +
      personalityFit,
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

  return {
    profile: {
      accent: getAccent(score, index),
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
      image: candidate.avatar_url ?? fallbackAvatars[index % fallbackAvatars.length],
      isSaved,
      match: score,
      name: candidate.display_name ?? "Tribe member",
      pace:
        candidate.social_pace ??
        availabilityLabels[candidateOnboarding.availability],
      prompts: ensureAtLeast(reasons, [
        "Ask what they are hoping to make more room for.",
        "Compare a low-pressure plan that fits both of your schedules.",
        "Start with the shared interest that feels easiest.",
      ]).slice(0, 3),
      reasons,
      signal: reasons[0] ?? candidateOnboarding.primary_goal,
      temperament:
        candidate.temperament_summary ??
        conversationStyleLabels[candidateOnboarding.conversation_style],
      traits,
      userId: candidate.user_id,
      values: ensureAtLeast(values, [
        intentLabels[candidateOnboarding.intent].toLowerCase(),
      ]),
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
