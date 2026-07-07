import type { User } from "@clerk/nextjs/server";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { ProfileInput } from "./schema";

const profileMediaBucket = "profile-media";
const profileMediaMaxBytes = 10 * 1024 * 1024;
export const minimumDiscoveryPhotoCount = 3;
export const profilePhotoRequirementMessage =
  "Upload at least 3 real profile photos to unlock discovery.";
const profilePhotoMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const profileVoiceMimeTypes = [
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
] as const;
const profileMediaMimeTypes = [
  ...profilePhotoMimeTypes,
  ...profileVoiceMimeTypes,
] as const;
const profilePhotoExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const profileVoiceExtensions: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

export class ProfileMediaUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProfileMediaUploadError";
    this.status = status;
  }
}

export class ProfileQualityRequirementError extends Error {
  requiredPhotoCount: number;
  status: number;
  uploadedPhotoCount: number;

  constructor({
    message = profilePhotoRequirementMessage,
    requiredPhotoCount = minimumDiscoveryPhotoCount,
    status = 403,
    uploadedPhotoCount,
  }: {
    message?: string;
    requiredPhotoCount?: number;
    status?: number;
    uploadedPhotoCount: number;
  }) {
    super(message);
    this.name = "ProfileQualityRequirementError";
    this.requiredPhotoCount = requiredPhotoCount;
    this.status = status;
    this.uploadedPhotoCount = uploadedPhotoCount;
  }
}

type UserAccount = {
  banned_at?: string | null;
  clerk_user_id: string;
  created_at: string;
  email: string;
  id: string;
  last_seen_at: string | null;
  moderation_reason?: string | null;
  moderation_status?: "active" | "banned" | "shadow_banned" | "suspended";
  shadow_banned_at?: string | null;
  status: string;
  suspended_until?: string | null;
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
  email_verified_at: string | null;
  identity_verified_at: string | null;
  id: string;
  onboarding_completed_at: string | null;
  phone_verified_at: string | null;
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

export type ProfileVerification = {
  email: boolean;
  identity: boolean;
  phone: boolean;
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
  hasMinimumPhotos: boolean;
  minimumPhotoCount: number;
  photos: ProfilePhoto[];
  prompts: ProfilePrompt[];
  uploadedPhotoCount: number;
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

export function getProfileVerification(
  profile: Pick<
    ProfileRecord,
    "email_verified_at" | "identity_verified_at" | "phone_verified_at"
  >,
): ProfileVerification {
  return {
    email: Boolean(profile.email_verified_at),
    identity: Boolean(profile.identity_verified_at),
    phone: Boolean(profile.phone_verified_at),
  };
}

export function isRealProfilePhoto(
  photo: Pick<ProfilePhoto, "image_url" | "storage_path">,
) {
  return Boolean(photo.storage_path) && !isSupplementaryProfileImage(photo);
}

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
    if (isEmailVerified && !existingProfile.email_verified_at) {
      const { data: verifiedProfile, error: verificationError } = await supabase
        .from("profiles")
        .update({ email_verified_at: now, updated_at: now })
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
      email_verified_at: isEmailVerified ? now : null,
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
    await trackAnalyticsEvent({
      eventType:
        quality.completeness >= 80 &&
        ownedProfile.profile.profile_completion_score < 80
          ? "profile_completed"
          : "profile_completion_changed",
      ownedProfile,
      properties: {
        nextCompletion: quality.completeness,
        previousCompletion: ownedProfile.profile.profile_completion_score,
      },
    });
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

export async function getProfilePhotoRequirementState(profileId: string) {
  const photos = await getProfilePhotos(profileId);
  const realPhotos = photos.filter(isRealProfilePhoto);

  return {
    hasMinimumPhotos: realPhotos.length >= minimumDiscoveryPhotoCount,
    minimumPhotoCount: minimumDiscoveryPhotoCount,
    uploadedPhotoCount: realPhotos.length,
  };
}

export async function assertOwnedProfileHasMinimumPhotos(
  ownedProfile: OwnedProfile,
) {
  const state = await getProfilePhotoRequirementState(ownedProfile.profile.id);

  if (!state.hasMinimumPhotos) {
    throw new ProfileQualityRequirementError(state);
  }

  return state;
}

export async function assertProfileHasMinimumPhotos(profileId: string) {
  const state = await getProfilePhotoRequirementState(profileId);

  if (!state.hasMinimumPhotos) {
    throw new ProfileQualityRequirementError(state);
  }

  return state;
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
    throw new ProfileMediaUploadError("At least one profile photo is required.");
  }

  const supabase = createSupabaseAdminClient();
  await ensureProfileMediaBucket(supabase);

  const existingPhotos = await getProfilePhotos(ownedProfile.profile.id);
  const availableSlots = Math.max(0, 6 - existingPhotos.length);
  const uploads = files.slice(0, availableSlots);

  if (uploads.length === 0) {
    throw new ProfileMediaUploadError(
      "You already have the maximum of 6 profile photos.",
    );
  }

  uploads.forEach(validateProfilePhotoFile);

  const insertedPhotos: ProfilePhoto[] = [];

  for (const [index, file] of uploads.entries()) {
    const { publicUrl, storagePath } = await uploadProfileMediaObject({
      file,
      kind: "photos",
      ownedProfile,
      supabase,
    });
    const isPrimary = existingPhotos.length === 0 && index === 0;
    const { data: photo, error: insertError } = await supabase
      .from("profile_photos")
      .insert({
        image_url: publicUrl,
        is_primary: isPrimary,
        profile_id: ownedProfile.profile.id,
        sort_order: existingPhotos.length + index,
        storage_path: storagePath,
      })
      .select("*")
      .single();

    if (insertError) {
      await removeProfileMediaObjects(supabase, [storagePath]);
      throw new ProfileMediaUploadError(
        `Photo uploaded to storage, but the profile photo record could not be saved: ${getServiceErrorMessage(
          insertError,
        )}`,
        500,
      );
    }

    insertedPhotos.push(photo as ProfilePhoto);
  }

  if (!ownedProfile.profile.avatar_url && insertedPhotos[0]) {
    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_url: insertedPhotos[0].image_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ownedProfile.profile.id);

    if (error) {
      throw new ProfileMediaUploadError(
        `Photos uploaded, but the primary profile image could not be updated: ${getServiceErrorMessage(
          error,
        )}`,
        500,
      );
    }
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
    throw new ProfileMediaUploadError(
      "Voice introduction must be an audio file.",
    );
  }

  if (durationSeconds < 30 || durationSeconds > 60) {
    throw new ProfileMediaUploadError(
      "Voice introduction must be between 30 and 60 seconds.",
    );
  }

  validateVoiceIntroFile(file);

  const supabase = createSupabaseAdminClient();
  await ensureProfileMediaBucket(supabase);

  const { publicUrl, storagePath } = await uploadProfileMediaObject({
    file,
    kind: "voice",
    ownedProfile,
    supabase,
  });
  const { data: profile, error: updateError } = await supabase
    .from("profiles")
    .update({
      updated_at: new Date().toISOString(),
      voice_intro_duration_seconds: Math.round(durationSeconds),
      voice_intro_storage_path: storagePath,
      voice_intro_url: publicUrl,
    })
    .eq("id", ownedProfile.profile.id)
    .select("*")
    .single();

  if (updateError) {
    await removeProfileMediaObjects(supabase, [storagePath]);
    throw new ProfileMediaUploadError(
      `Voice file uploaded to storage, but the profile record could not be updated: ${getServiceErrorMessage(
        updateError,
      )}`,
      500,
    );
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

async function ensureProfileMediaBucket(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const bucketOptions = {
    allowedMimeTypes: [...profileMediaMimeTypes],
    fileSizeLimit: profileMediaMaxBytes,
    public: true,
  };
  const { data: bucket, error: readError } =
    await supabase.storage.getBucket(profileMediaBucket);

  if (readError) {
    if (!isNotFoundError(readError)) {
      throw new ProfileMediaUploadError(
        `Could not verify profile media storage: ${getServiceErrorMessage(
          readError,
        )}`,
        500,
      );
    }

    const { error: createError } = await supabase.storage.createBucket(
      profileMediaBucket,
      bucketOptions,
    );

    if (createError && !isAlreadyExistsError(createError)) {
      throw new ProfileMediaUploadError(
        `Profile media storage is missing and could not be created: ${getServiceErrorMessage(
          createError,
        )}`,
        500,
      );
    }

    return;
  }

  const bucketConfig = bucket as {
    allowed_mime_types?: string[] | null;
    file_size_limit?: number | string | null;
    public?: boolean;
  };
  const configuredMimeTypes = new Set(bucketConfig.allowed_mime_types ?? []);
  const shouldUpdateBucket =
    bucketConfig.public !== true ||
    Number(bucketConfig.file_size_limit ?? 0) !== profileMediaMaxBytes ||
    profileMediaMimeTypes.some((mimeType) => !configuredMimeTypes.has(mimeType));

  if (!shouldUpdateBucket) {
    return;
  }

  const { error: updateError } = await supabase.storage.updateBucket(
    profileMediaBucket,
    bucketOptions,
  );

  if (updateError) {
    throw new ProfileMediaUploadError(
      `Profile media storage could not be configured: ${getServiceErrorMessage(
        updateError,
      )}`,
      500,
    );
  }
}

async function uploadProfileMediaObject({
  file,
  kind,
  ownedProfile,
  supabase,
}: {
  file: File;
  kind: "photos" | "voice";
  ownedProfile: OwnedProfile;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}) {
  const extension = getFileExtension(file.name, file.type, kind);
  const storagePath = [
    "users",
    ownedProfile.account.id,
    "profiles",
    ownedProfile.profile.id,
    kind,
    `${crypto.randomUUID()}.${extension}`,
  ].join("/");
  let fileBody: ArrayBuffer;

  try {
    fileBody = await file.arrayBuffer();
  } catch {
    throw new ProfileMediaUploadError(
      `Could not read the selected ${kind === "photos" ? "photo" : "voice intro"} file.`,
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(profileMediaBucket)
    .upload(storagePath, fileBody, {
      cacheControl: "3600",
      contentType: file.type,
      metadata: {
        kind,
        owner_user_id: ownedProfile.account.id,
        profile_id: ownedProfile.profile.id,
      },
      upsert: false,
    });

  if (uploadError) {
    throw new ProfileMediaUploadError(
      `Profile media upload failed for the ${kind === "photos" ? "photo" : "voice intro"}: ${getServiceErrorMessage(
        uploadError,
      )}`,
      500,
    );
  }

  const { data } = supabase.storage
    .from(profileMediaBucket)
    .getPublicUrl(storagePath);

  if (!data.publicUrl) {
    await removeProfileMediaObjects(supabase, [storagePath]);
    throw new ProfileMediaUploadError(
      `Profile media storage did not return a public URL for the uploaded ${kind === "photos" ? "photo" : "voice intro"}.`,
      500,
    );
  }

  return {
    publicUrl: data.publicUrl,
    storagePath,
  };
}

async function removeProfileMediaObjects(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  paths: string[],
) {
  if (paths.length === 0) {
    return;
  }

  await supabase.storage.from(profileMediaBucket).remove(paths);
}

function validateProfilePhotoFile(file: File) {
  validateProfileMediaFile({
    allowedMimeTypes: profilePhotoMimeTypes,
    file,
    label: "Profile photo",
  });
}

function validateVoiceIntroFile(file: File) {
  validateProfileMediaFile({
    allowedMimeTypes: profileVoiceMimeTypes,
    file,
    label: "Voice introduction",
  });
}

function validateProfileMediaFile({
  allowedMimeTypes,
  file,
  label,
}: {
  allowedMimeTypes: readonly string[];
  file: File;
  label: string;
}) {
  if (!file.name && file.size === 0) {
    throw new ProfileMediaUploadError(`${label} file is required.`);
  }

  if (file.size <= 0) {
    throw new ProfileMediaUploadError(`${label} file is empty.`);
  }

  if (file.size > profileMediaMaxBytes) {
    throw new ProfileMediaUploadError(
      `${label} must be 10 MB or smaller.`,
      413,
    );
  }

  if (!allowedMimeTypes.includes(file.type as (typeof allowedMimeTypes)[number])) {
    throw new ProfileMediaUploadError(
      `${label} must use one of these formats: ${allowedMimeTypes.join(", ")}.`,
    );
  }
}

function buildProfileQuality(
  profile: ProfileRecord,
  photos: ProfilePhoto[],
  prompts: ProfilePrompt[],
): ProfileQualitySnapshot {
  const completedPrompts = prompts.filter((prompt) => prompt.answer.trim());
  const realPhotos = photos.filter(isRealProfilePhoto);
  const hasMinimumPhotos = realPhotos.length >= minimumDiscoveryPhotoCount;
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
      complete: hasMinimumPhotos,
      label: profilePhotoRequirementMessage,
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
  const rawCompleteness = Math.min(
    100,
    checklist.reduce(
      (total, item) => total + (item.complete ? item.points : 0),
      0,
    ),
  );
  const completeness = hasMinimumPhotos
    ? rawCompleteness
    : Math.min(rawCompleteness, 79);

  return {
    checklist,
    completeness,
    hasMinimumPhotos,
    minimumPhotoCount: minimumDiscoveryPhotoCount,
    photos,
    prompts,
    uploadedPhotoCount: realPhotos.length,
  };
}

function isSupplementaryProfileImage(
  photo: Pick<ProfilePhoto, "image_url" | "storage_path">,
) {
  const imageUrl = photo.image_url.toLowerCase();

  return imageUrl.includes("/avatars/");
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

function getFileExtension(
  fileName: string,
  mimeType: string,
  kind: "photos" | "voice",
) {
  const extensionByMimeType =
    kind === "photos" ? profilePhotoExtensions : profileVoiceExtensions;
  const mimeExtension = extensionByMimeType[mimeType];

  if (mimeExtension) {
    return mimeExtension;
  }

  const explicitExtension = fileName.split(".").pop()?.toLowerCase();

  if (explicitExtension && /^[a-z0-9]+$/.test(explicitExtension)) {
    return explicitExtension;
  }

  const fallback = mimeType.split("/")[1]?.replace("jpeg", "jpg");

  return fallback || "bin";
}

function isNotFoundError(error: unknown) {
  return (
    getErrorStatus(error) === 404 ||
    getServiceErrorMessage(error).toLowerCase().includes("not found")
  );
}

function isAlreadyExistsError(error: unknown) {
  const message = getServiceErrorMessage(error).toLowerCase();

  return getErrorStatus(error) === 409 || message.includes("already exists");
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const status = (error as { status?: unknown }).status;

  return typeof status === "number" ? status : null;
}

function getServiceErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;

    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }

  return "Unknown error";
}
