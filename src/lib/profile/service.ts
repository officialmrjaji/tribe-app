import type { User } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { ProfileInput } from "./schema";

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
  region: string | null;
  social_pace: string | null;
  temperament_summary: string | null;
  updated_at: string;
  user_id: string;
  visibility: "private" | "members" | "discoverable";
};

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

export async function ensureOwnedProfile({
  clerkUserId,
  email,
  imageUrl,
  name,
}: {
  clerkUserId: string;
  email: string;
  imageUrl?: string | null;
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
    return { account, profile: existingProfile };
  }

  const { data: profile, error: profileWriteError } = await supabase
    .from("profiles")
    .insert({
      avatar_url: imageUrl ?? null,
      clerk_user_id: clerkUserId,
      display_name: name ?? null,
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

  return { account: ownedProfile.account, profile };
}
