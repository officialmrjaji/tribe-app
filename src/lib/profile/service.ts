import type { User } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { ProfileInput } from "./schema";

const profileMediaBucket = "profile-media";

type UserAccount = {
  clerk_user_id: string;
  created_at: string;
  email: string;
  id: string;
  last_seen_at: string | null;
  status: string;
  updated_at: string;
};

type ProfileRecord = {
  archetype: string | null;
  avatar_url: string | null;
  bio: string | null;
  birthdate: string | null;
  city: string | null;
  clerk_user_id: string;
  country: string | null;
  created_at: string;
  discoverable: boolean;
  display_name: string | null;
  id: string;
  onboarding_completed_at: string | null;
  profile_completion_score: number;
  region: string | null;
  social_pace: string | null;
  temperament_summary: string | null;
  updated_at: string;
  user_id: string;
  verified_at: string | null;
  visibility: "private" | "members" | "discoverable";
  voice_intro_duration_seconds: number | null;
  voice_intro_storage_path: string | null;
  voice_intro_url: string | null;
};

export type ProfilePhoto = {
  alt_text: string | null;
  created_at: string;
  id: string;
  image_url: string;
  is_primary: boolean;
  profile_id: string;
  sort_order: number;
  storage_path: string | null;
  updated_at: string;
};

export type ProfilePrompt = {
  answer: string;
  id: string;
  profile_id: string;
  prompt_key: string;
  prompt_text: string;
  sort_order: number;
};

export type ProfilePromptInput = {
  answer: string;
  promptKey: string;
};

export type ProfileQualitySnapshot = {
  checklist: Array<{
    complete: boolean;
    label: string;
    points: number;
  }>;
  completeness: number;
  photos: ProfilePhoto[];
  prompts: ProfilePrompt[];
};

export const profilePromptOptions = [
  {
    key: "perfect_weekend",
    text: "A perfect weekend is...",
  },
  {
    key: "people_notice",
    text: "People usually notice that I...",
  },
  {
    key: "looking_for",
    text: "Right now I am looking for...",
  },
] as const;

export type OwnedProfile = {
  account: UserAccount;
  profile: ProfileRecord;
};

export function getPrimaryEmail(user: User) {
  return (
    user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    )?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    ""
  );
}

export function getPrimaryEmailVerified(user: User) {
  const primaryEmail =
    user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    ) ?? user.emailAddresses[0];

  return primaryEmail?.verification?.status === "verified";
}

export async function ensureOwnedProfile({
  clerkUserId,
  email,
  imageUrl,
  isEmailVerified,
  name,
}: {
  clerkUserId: string;
  email: string;
  imageUrl?: string | null;
  isEmailVerified?: boolean;
  name?: string | null;
}): Promise<OwnedProfile> {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: existingAccount, error: accountReadError } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (accountReadError) {
    throw accountReadError;
  }

  const { data: account, error: accountWriteError } = existingAccount
    ? await supabase
        .from("users")
        .update({ email, last_seen_at: now, updated_at: now })
        .eq("id", existingAccount.id)
        .select("*")
        .single()
    : await supabase
        .from("users")
        .insert({ clerk_user_id: clerkUserId, email, last_seen_at: now })
        .select("*")
        .single();

  if (accountWriteError || !account) {
    throw accountWriteError ?? new Error("Unable to create user account.");
  }

  const { data: existingProfile, error: profileReadError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", account.id)
    .maybeSingle();

  if (profileReadError) {
    throw profileReadError;
  }

  if (existingProfile) {
    if (isEmailVerified && !existingProfile.verified_at) {
      const { data: verifiedProfile, error: verificationError } = await supabase
        .from("profiles")
        .update({ updated_at: now, verified_at: now })
        .eq("id", existingProfile.id)
        .select("*")
        .single();

      if (verificationError) {
        throw verificationError;
      }

      return { account, profile: verifiedProfile };
    }

    return { account, profile: existingProfile };
  }

  const { data: profile, error: profileWriteError } = await supabase
    .from("profiles")
    .insert({
      avatar_url: imageUrl ?? null,
      clerk_user_id: clerkUserId,
      display_name: name ?? null,
      verified_at: isEmailVerified ? now : null,
      user_id: account.id,
    })
    .select("*")
    .single();

  if (profileWriteError || !profile) {
    throw profileWriteError ?? new Error("Unable to create profile.");
  }

  return { account, profile };
}

export async function getOwnedProfile(clerkUserId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: account, error: accountError } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (accountError) {
    throw accountError;
  }

  if (!account) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", account.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return null;
  }

  return { account, profile };
}

export async function getProfileQuality(
  ownedProfile: OwnedProfile,
): Promise<ProfileQualitySnapshot> {
  const [photos, prompts] = await Promise.all([
    getProfilePhotos(ownedProfile.profile.id),
    getProfilePrompts(ownedProfile.profile.id),
  ]);
  const quality = buildProfileQuality(ownedProfile.profile, photos, prompts);

  if (quality.completeness !== ownedProfile.profile.profile_completion_score) {
    await updateProfileCompletion(ownedProfile.profile.id, quality.completeness);
  }

  return quality;
}

export async function getProfilePhotos(profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profile_photos")
    .select("*")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProfilePhoto[];
}

export async function getProfilePrompts(profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profile_prompts")
    .select("*")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProfilePrompt[];
}

export async function saveProfilePrompts(
  ownedProfile: OwnedProfile,
  prompts: ProfilePromptInput[],
) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const rows = prompts.flatMap((prompt) => {
    const definition = profilePromptOptions.find(
      (option) => option.key === prompt.promptKey,
    );
    const answer = prompt.answer.trim();

    if (!definition || !answer) {
      return [];
    }

    return [
      {
        answer,
        profile_id: ownedProfile.profile.id,
        prompt_key: definition.key,
        prompt_text: definition.text,
        sort_order: profilePromptOptions.indexOf(definition),
        updated_at: now,
      },
    ];
  });

  const submittedKeys = prompts.map((prompt) => prompt.promptKey);
  const blankKeys = profilePromptOptions
    .filter(
      (option) =>
        submittedKeys.includes(option.key) &&
        !prompts.find((prompt) => prompt.promptKey === option.key)?.answer.trim(),
    )
    .map((option) => option.key);

  if (rows.length) {
    const { error } = await supabase
      .from("profile_prompts")
      .upsert(rows, { onConflict: "profile_id,prompt_key" });

    if (error) {
      throw error;
    }
  }

  if (blankKeys.length) {
    const { error } = await supabase
      .from("profile_prompts")
      .delete()
      .eq("profile_id", ownedProfile.profile.id)
      .in("prompt_key", blankKeys);

    if (error) {
      throw error;
    }
  }

  return refreshProfileQuality(ownedProfile);
}

export async function uploadProfilePhotos(
  ownedProfile: OwnedProfile,
  files: File[],
) {
  if (files.length === 0) {
    return getProfileQuality(ownedProfile);
  }

  const supabase = createSupabaseAdminClient();
  const existingPhotos = await getProfilePhotos(ownedProfile.profile.id);
  const availableSlots = Math.max(0, 6 - existingPhotos.length);
  const uploads = files.slice(0, availableSlots);

  if (uploads.length === 0) {
    return getProfileQuality(ownedProfile);
  }

  const insertedPhotos: ProfilePhoto[] = [];

  for (const [index, file] of uploads.entries()) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Profile photos must be image files.");
    }

    const extension = getFileExtension(file.name, file.type);
    const storagePath = `profiles/${ownedProfile.profile.id}/photos/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(profileMediaBucket)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrl } = supabase.storage
      .from(profileMediaBucket)
      .getPublicUrl(storagePath);
    const isPrimary = existingPhotos.length === 0 && index === 0;
    const { data: photo, error: insertError } = await supabase
      .from("profile_photos")
      .insert({
        image_url: publicUrl.publicUrl,
        is_primary: isPrimary,
        profile_id: ownedProfile.profile.id,
        sort_order: existingPhotos.length + index,
        storage_path: storagePath,
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    insertedPhotos.push(photo as ProfilePhoto);
  }

  if (!ownedProfile.profile.avatar_url && insertedPhotos[0]) {
    await supabase
      .from("profiles")
      .update({
        avatar_url: insertedPhotos[0].image_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ownedProfile.profile.id);
  }

  return refreshProfileQuality(ownedProfile);
}

export async function uploadVoiceIntroduction({
  durationSeconds,
  file,
  ownedProfile,
}: {
  durationSeconds: number;
  file: File;
  ownedProfile: OwnedProfile;
}) {
  if (!file.type.startsWith("audio/")) {
    throw new Error("Voice introduction must be an audio file.");
  }

  if (durationSeconds < 30 || durationSeconds > 60) {
    throw new Error("Voice introduction must be between 30 and 60 seconds.");
  }

  const supabase = createSupabaseAdminClient();
  const extension = getFileExtension(file.name, file.type);
  const storagePath = `profiles/${ownedProfile.profile.id}/voice/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(profileMediaBucket)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrl } = supabase.storage
    .from(profileMediaBucket)
    .getPublicUrl(storagePath);
  const { data: profile, error: updateError } = await supabase
    .from("profiles")
    .update({
      updated_at: new Date().toISOString(),
      voice_intro_duration_seconds: Math.round(durationSeconds),
      voice_intro_storage_path: storagePath,
      voice_intro_url: publicUrl.publicUrl,
    })
    .eq("id", ownedProfile.profile.id)
    .select("*")
    .single();

  if (updateError) {
    throw updateError;
  }

  return getProfileQuality({
    account: ownedProfile.account,
    profile: profile as ProfileRecord,
  });
}

export async function updateOwnedProfile(
  clerkUserId: string,
  input: ProfileInput,
) {
  const ownedProfile = await getOwnedProfile(clerkUserId);

  if (!ownedProfile) {
    return null;
  }

  const updates = {
    archetype: input.archetype,
    avatar_url: input.avatarUrl,
    bio: input.bio,
    birthdate: input.birthdate,
    city: input.city,
    country: input.country,
    discoverable: input.discoverable,
    display_name: input.displayName,
    region: input.region,
    social_pace: input.socialPace,
    temperament_summary: input.temperamentSummary,
    updated_at: new Date().toISOString(),
    visibility: input.visibility,
  };

  const sanitizedUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  );

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .update(sanitizedUpdates)
    .eq("id", ownedProfile.profile.id)
    .eq("clerk_user_id", clerkUserId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const quality = await getProfileQuality({
    account: ownedProfile.account,
    profile: profile as ProfileRecord,
  });

  return {
    account: ownedProfile.account,
    profile: {
      ...(profile as ProfileRecord),
      profile_completion_score: quality.completeness,
    },
  };
}

async function refreshProfileQuality(ownedProfile: OwnedProfile) {
  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", ownedProfile.profile.id)
    .single();

  if (error) {
    throw error;
  }

  return getProfileQuality({
    account: ownedProfile.account,
    profile: profile as ProfileRecord,
  });
}

function buildProfileQuality(
  profile: ProfileRecord,
  photos: ProfilePhoto[],
  prompts: ProfilePrompt[],
): ProfileQualitySnapshot {
  const completedPrompts = prompts.filter((prompt) => prompt.answer.trim());
  const checklist = [
    {
      complete: Boolean(profile.display_name),
      label: "Display name",
      points: 10,
    },
    {
      complete: Boolean(profile.bio && profile.bio.length >= 40),
      label: "Bio with enough context",
      points: 15,
    },
    {
      complete: Boolean(profile.city && profile.country),
      label: "City and country",
      points: 10,
    },
    {
      complete: Boolean(profile.birthdate),
      label: "Age context",
      points: 5,
    },
    {
      complete: Boolean(profile.onboarding_completed_at),
      label: "Personality onboarding",
      points: 15,
    },
    {
      complete: photos.length > 0 || Boolean(profile.avatar_url),
      label: "Profile photo",
      points: 15,
    },
    {
      complete: completedPrompts.length >= 2,
      label: "Profile prompts",
      points: 15,
    },
    {
      complete: Boolean(
        profile.voice_intro_url &&
          profile.voice_intro_duration_seconds &&
          profile.voice_intro_duration_seconds >= 30 &&
          profile.voice_intro_duration_seconds <= 60,
      ),
      label: "Voice intro",
      points: 10,
    },
    {
      complete: profile.discoverable && profile.visibility !== "private",
      label: "Discovery visibility",
      points: 5,
    },
  ];
  const completeness = Math.min(
    100,
    checklist.reduce(
      (total, item) => total + (item.complete ? item.points : 0),
      0,
    ),
  );

  return {
    checklist,
    completeness,
    photos,
    prompts,
  };
}

async function updateProfileCompletion(profileId: string, completeness: number) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      profile_completion_score: completeness,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (error) {
    throw error;
  }
}

function getFileExtension(fileName: string, mimeType: string) {
  const explicitExtension = fileName.split(".").pop()?.toLowerCase();

  if (explicitExtension && /^[a-z0-9]+$/.test(explicitExtension)) {
    return explicitExtension;
  }

  const fallback = mimeType.split("/")[1]?.replace("jpeg", "jpg");

  return fallback || "bin";
}
