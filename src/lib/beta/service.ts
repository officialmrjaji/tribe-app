import "server-only";

import { badRequest, forbidden } from "@/lib/api/errors";
import type { OwnedProfile } from "@/lib/profile/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { BetaFeedbackInput } from "./schema";

type InviteRedemptionResult = {
  invite_code_id: string | null;
  result: "already_redeemed" | "expired" | "full" | "inactive" | "invalid" | "redeemed";
};

export type BetaInviteUsage = {
  active: boolean;
  codeLabel: string;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number;
  redemptions: Array<{
    email: string;
    redeemedAt: string;
  }>;
  usedCount: number;
};

export async function hasBetaAccess(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("beta_invite_redemptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function assertBetaAccess(userId: string) {
  if (!(await hasBetaAccess(userId))) {
    throw forbidden(
      "A valid private beta invite is required before you can continue.",
    );
  }
}

export async function redeemBetaInvite({
  code,
  userId,
}: {
  code: string;
  userId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("redeem_beta_invite", {
    p_code: code,
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  const redemption = (data?.[0] ?? null) as InviteRedemptionResult | null;

  if (!redemption) {
    throw new Error("Invite validation returned no result.");
  }

  if (redemption.result === "redeemed" || redemption.result === "already_redeemed") {
    return {
      alreadyRedeemed: redemption.result === "already_redeemed",
      inviteCodeId: redemption.invite_code_id,
    };
  }

  const messages: Record<Exclude<InviteRedemptionResult["result"], "already_redeemed" | "redeemed">, string> = {
    expired: "This invite code has expired.",
    full: "This invite code has reached its usage limit.",
    inactive: "This invite code is no longer active.",
    invalid: "This invite code is not valid.",
  };

  throw badRequest(messages[redemption.result]);
}

export async function submitBetaFeedback({
  input,
  ownedProfile,
}: {
  input: BetaFeedbackInput;
  ownedProfile: OwnedProfile;
}) {
  await assertBetaAccess(ownedProfile.account.id);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("beta_feedback")
    .insert({
      category: input.category,
      message: input.message,
      profile_id: ownedProfile.profile.id,
      rating: input.rating,
      screenshot_or_link: input.screenshotOrLink || null,
      user_id: ownedProfile.account.id,
    })
    .select("id, created_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    createdAt: data.created_at as string,
    feedbackId: data.id as string,
  };
}

export async function listBetaInviteUsage(): Promise<BetaInviteUsage[]> {
  const supabase = createSupabaseAdminClient();
  const { data: inviteCodes, error: inviteError } = await supabase
    .from("invite_codes")
    .select("id, code, max_uses, used_count, active, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (inviteError) {
    throw inviteError;
  }

  const codeIds = (inviteCodes ?? []).map((invite) => invite.id as string);
  const { data: redemptions, error: redemptionError } = codeIds.length
    ? await supabase
        .from("beta_invite_redemptions")
        .select("invite_code_id, user_id, redeemed_at")
        .in("invite_code_id", codeIds)
        .order("redeemed_at", { ascending: false })
    : { data: [], error: null };

  if (redemptionError) {
    throw redemptionError;
  }

  const userIds = (redemptions ?? []).map((redemption) => redemption.user_id as string);
  const { data: users, error: usersError } = userIds.length
    ? await supabase.from("users").select("id, email").in("id", userIds)
    : { data: [], error: null };

  if (usersError) {
    throw usersError;
  }

  const emailByUserId = new Map(
    (users ?? []).map((user) => [user.id as string, user.email as string]),
  );

  return (inviteCodes ?? []).map((invite) => ({
    active: Boolean(invite.active),
    codeLabel: maskInviteCode(String(invite.code)),
    createdAt: String(invite.created_at),
    expiresAt: invite.expires_at ? String(invite.expires_at) : null,
    maxUses: Number(invite.max_uses),
    redemptions: (redemptions ?? [])
      .filter((redemption) => redemption.invite_code_id === invite.id)
      .map((redemption) => ({
        email: emailByUserId.get(String(redemption.user_id)) ?? "Unknown member",
        redeemedAt: String(redemption.redeemed_at),
      })),
    usedCount: Number(invite.used_count),
  }));
}

function maskInviteCode(code: string) {
  const trimmed = code.trim();

  if (trimmed.length <= 6) {
    return `${trimmed.slice(0, 2)}****`;
  }

  return `${trimmed.slice(0, 3)}${"*".repeat(Math.min(8, trimmed.length - 5))}${trimmed.slice(-2)}`;
}
