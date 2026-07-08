import { auth, currentUser, type User } from "@clerk/nextjs/server";
import { forbidden, unauthorized } from "@/lib/api/errors";
import { getAnalyticsOverview } from "@/lib/analytics/service";
import { listBetaInviteUsage } from "@/lib/beta/service";
import {
  ensureOwnedProfile,
  getPrimaryEmail,
  getPrimaryEmailVerified,
  type OwnedProfile,
} from "@/lib/profile/service";
import { recordModerationAudit } from "@/lib/security/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  announcementCreateSchema,
  featureFlagUpdateSchema,
  moderationActionSchema,
} from "./schema";
import type { z } from "zod";

export type AdminRole = "admin" | "moderator" | "owner" | "support";

export type AdminAccess = {
  clerkUser: User;
  ownedProfile: OwnedProfile;
  role: AdminRole;
};

type AdminRoleRow = {
  active: boolean;
  role: AdminRole;
};

type UserSearchRow = {
  banned_at: string | null;
  created_at: string;
  email: string;
  id: string;
  last_seen_at: string | null;
  moderation_status: string;
  suspended_until: string | null;
};

type ProfileSearchRow = {
  display_name: string | null;
  id: string;
  profile_completion_score: number;
  user_id: string;
  visibility: string;
};

type ReportQueueItem = {
  created_at: string;
  reason: string;
  source: string;
  status: string;
};

const defaultFeatureFlags = [
  {
    description: "Controls production rollout for AI assistant surfaces.",
    enabled: true,
    key: "ai_companion",
    name: "AI Companion",
    rollout_percentage: 100,
  },
  {
    description: "Controls production rollout for Square community feed.",
    enabled: true,
    key: "square_feed",
    name: "Square Feed",
    rollout_percentage: 100,
  },
  {
    description: "Controls production rollout for voice matching and rooms.",
    enabled: true,
    key: "voice_experience",
    name: "Voice Experience",
    rollout_percentage: 100,
  },
  {
    description: "Controls Premium and boost checkout availability.",
    enabled: true,
    key: "tribe_premium",
    name: "Tribe Premium",
    rollout_percentage: 100,
  },
] as const;

export async function requireAdminAccess(): Promise<AdminAccess> {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    throw unauthorized();
  }

  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw unauthorized("User session could not be loaded.");
  }

  const role = await resolveAdminRole(clerkUser);

  if (!role) {
    throw forbidden("Admin access is required.");
  }

  const ownedProfile = await ensureOwnedProfile({
    clerkUserId: userId,
    email: getPrimaryEmail(clerkUser),
    imageUrl: clerkUser.imageUrl,
    isEmailVerified: getPrimaryEmailVerified(clerkUser),
    name: clerkUser.fullName,
  });

  return {
    clerkUser,
    ownedProfile,
    role,
  };
}

export async function getAdminDashboard({
  query,
}: {
  query?: string;
} = {}) {
  const now = new Date().toISOString();
  const [
    users,
    profiles,
    reports,
    messageReports,
    squareReports,
    activeSubscriptions,
    activeBoosts,
    openVoiceRooms,
    analytics,
    searchedUsers,
    reportQueue,
    verificationQueue,
    moderationQueue,
    paymentRows,
    voiceRooms,
    featureFlags,
    announcements,
    betaInvites,
  ] = await Promise.all([
    countRows("users"),
    countRows("profiles"),
    countRows("reports", "status", ["open", "reviewing"]),
    countRows("message_reports", "status", ["open", "reviewing"]),
    countRows("square_reports", "status", ["open", "reviewing"]),
    countRows("premium_subscriptions", "status", ["active"], {
      column: "current_period_end",
      value: now,
    }),
    countRows("profile_boosts", "status", ["active"], {
      column: "expires_at",
      value: now,
    }),
    countRows("voice_rooms", "status", ["open", "scheduled"]),
    getAnalyticsOverview(),
    searchUsers(query ?? ""),
    listReportsQueue(),
    listVerificationQueue(),
    listModerationQueue(),
    listPaymentsOverview(),
    listVoiceRoomsOverview(),
    listFeatureFlags(),
    listAnnouncements(),
    listBetaInviteUsage(),
  ]);

  return {
    analytics,
    announcements,
    betaInvites,
    featureFlags,
    moderationQueue,
    overview: {
      activeBoosts,
      activeSubscriptions,
      openReports: reports + messageReports + squareReports,
      openVoiceRooms,
      profiles,
      users,
    },
    payments: paymentRows,
    reports: reportQueue,
    users: searchedUsers,
    verificationQueue,
    voiceRooms,
  };
}

export async function performModerationAction({
  admin,
  input,
  requestId,
}: {
  admin: AdminAccess;
  input: z.infer<typeof moderationActionSchema>;
  requestId?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const expiresAt = input.durationDays
    ? new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000)
    : null;

  if (input.actionType !== "note" && !input.targetUserId && !input.subjectId) {
    throw forbidden("A moderation target is required.");
  }

  if (input.actionType === "user_suspended" && input.targetUserId) {
    const { error } = await supabase
      .from("users")
      .update({
        moderation_reason: input.reason,
        moderation_status: "suspended",
        suspended_until: expiresAt?.toISOString() ?? null,
        updated_at: now.toISOString(),
      })
      .eq("id", input.targetUserId);

    if (error) {
      throw error;
    }
  }

  if (input.actionType === "user_banned" && input.targetUserId) {
    const { error } = await supabase
      .from("users")
      .update({
        banned_at: now.toISOString(),
        moderation_reason: input.reason,
        moderation_status: "banned",
        updated_at: now.toISOString(),
      })
      .eq("id", input.targetUserId);

    if (error) {
      throw error;
    }
  }

  if (input.actionType === "shadow_banned" && input.targetUserId) {
    const { error } = await supabase
      .from("users")
      .update({
        moderation_reason: input.reason,
        moderation_status: "shadow_banned",
        shadow_banned_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", input.targetUserId);

    if (error) {
      throw error;
    }
  }

  if (input.actionType === "content_removed" && input.subjectId) {
    await removeContent({
      reason: input.reason,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
    });
  }

  if (input.caseId) {
    const { error } = await supabase
      .from("moderation_cases")
      .update({
        appeal_status: input.appealStatus ?? undefined,
        status:
          input.actionType === "note"
            ? "reviewing"
            : input.appealStatus === "submitted"
              ? "appealed"
              : "resolved",
        updated_at: now.toISOString(),
      })
      .eq("id", input.caseId);

    if (error) {
      throw error;
    }
  }

  const { data: action, error: actionError } = await supabase
    .from("moderation_actions")
    .insert({
      action_type: input.actionType,
      case_id: input.caseId ?? null,
      expires_at: expiresAt?.toISOString() ?? null,
      metadata: {
        appealStatus: input.appealStatus ?? null,
      },
      moderator_user_id: admin.ownedProfile.account.id,
      reason: input.reason,
      subject_id: input.subjectId ?? null,
      subject_type: input.subjectType,
      target_profile_id: input.targetProfileId ?? null,
      target_user_id: input.targetUserId ?? null,
    })
    .select("id")
    .single();

  if (actionError) {
    throw actionError;
  }

  await recordModerationAudit({
    action: input.actionType,
    actorClerkUserId: admin.clerkUser.id,
    actorUserId: admin.ownedProfile.account.id,
    metadata: {
      caseId: input.caseId ?? null,
      reason: input.reason,
    },
    requestId,
    targetId: input.targetUserId ?? input.subjectId ?? null,
    targetType: input.subjectType,
  });

  return {
    actionId: action.id as string,
    completed: true,
  };
}

export async function upsertFeatureFlag({
  admin,
  input,
  requestId,
}: {
  admin: AdminAccess;
  input: z.infer<typeof featureFlagUpdateSchema>;
  requestId?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("feature_flags").upsert(
    {
      description: input.description ?? null,
      enabled: input.enabled,
      key: input.key,
      name: input.name,
      rollout_percentage: input.rolloutPercentage,
      updated_at: new Date().toISOString(),
      updated_by_user_id: admin.ownedProfile.account.id,
    },
    { onConflict: "key" },
  );

  if (error) {
    throw error;
  }

  await recordModerationAudit({
    action: "feature_flag_updated",
    actorClerkUserId: admin.clerkUser.id,
    actorUserId: admin.ownedProfile.account.id,
    metadata: { enabled: input.enabled, rolloutPercentage: input.rolloutPercentage },
    requestId,
    targetId: input.key,
    targetType: "feature_flag",
  });

  return { updated: true };
}

export async function createAnnouncement({
  admin,
  input,
  requestId,
}: {
  admin: AdminAccess;
  input: z.infer<typeof announcementCreateSchema>;
  requestId?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      audience: input.audience,
      body: input.body,
      created_by_user_id: admin.ownedProfile.account.id,
      ends_at: input.endsAt ?? null,
      starts_at: input.startsAt ?? null,
      status: input.status,
      title: input.title,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await recordModerationAudit({
    action: "announcement_created",
    actorClerkUserId: admin.clerkUser.id,
    actorUserId: admin.ownedProfile.account.id,
    requestId,
    targetId: data.id as string,
    targetType: "announcement",
  });

  return { announcementId: data.id as string };
}

async function resolveAdminRole(user: User): Promise<AdminRole | null> {
  const email = getPrimaryEmail(user).toLowerCase();
  const allowedUserIds = parseList(process.env.TRIBE_ADMIN_CLERK_USER_IDS);
  const allowedEmails = parseList(process.env.TRIBE_ADMIN_EMAILS).map((value) =>
    value.toLowerCase(),
  );
  const metadataRole = user.publicMetadata?.role;

  if (allowedUserIds.includes(user.id) || allowedEmails.includes(email)) {
    return "owner";
  }

  if (
    metadataRole === "owner" ||
    metadataRole === "admin" ||
    metadataRole === "moderator" ||
    metadataRole === "support"
  ) {
    return metadataRole;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("admin_roles")
      .select("role, active")
      .eq("clerk_user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const row = data as AdminRoleRow | null;

    return row?.active ? row.role : null;
  } catch {
    return null;
  }
}

async function searchUsers(query: string) {
  const supabase = createSupabaseAdminClient();
  let userQuery = supabase
    .from("users")
    .select("id, email, status, moderation_status, suspended_until, banned_at, last_seen_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (query.trim()) {
    userQuery = userQuery.ilike("email", `%${query.trim()}%`);
  }

  const { data, error } = await userQuery;

  if (error) {
    throw error;
  }

  const users = (data ?? []) as UserSearchRow[];
  const userIds = users.map((user) => user.id);
  const profiles = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, user_id, display_name, visibility, profile_completion_score")
        .in("user_id", userIds)
    : { data: [], error: null };

  if (profiles.error) {
    throw profiles.error;
  }

  const profilesByUserId = new Map(
    ((profiles.data ?? []) as ProfileSearchRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );

  return users.map((user) => ({
    ...user,
    profile: profilesByUserId.get(user.id) ?? null,
  }));
}

async function listReportsQueue() {
  const supabase = createSupabaseAdminClient();
  const [profileReports, messageReports, squareReports] = await Promise.all([
    supabase
      .from("reports")
      .select("id, reporter_user_id, reported_user_id, reason, status, created_at")
      .in("status", ["open", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("message_reports")
      .select("id, reporter_user_id, reported_user_id, reason, status, created_at")
      .in("status", ["open", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("square_reports")
      .select("id, reporter_user_id, reported_user_id, reason, status, created_at")
      .in("status", ["open", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  for (const result of [profileReports, messageReports, squareReports]) {
    if (result.error) {
      throw result.error;
    }
  }

  return [
    ...formatReportRows("profile", profileReports.data ?? []),
    ...formatReportRows("message", messageReports.data ?? []),
    ...formatReportRows("square", squareReports.data ?? []),
  ]
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
    .slice(0, 12);
}

async function listVerificationQueue() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, email_verified_at, phone_verified_at, identity_verified_at, updated_at")
    .or("phone_verified_at.is.null,identity_verified_at.is.null")
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listModerationQueue() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("moderation_cases")
    .select("*")
    .in("status", ["open", "reviewing", "appealed"])
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listPaymentsOverview() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("premium_purchases")
    .select("id, user_id, plan_code, product_type, amount_kobo, status, paid_at, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listVoiceRoomsOverview() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("voice_rooms")
    .select("id, title, room_type, status, host_user_id, scheduled_at, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listFeatureFlags() {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("feature_flags")
    .upsert(defaultFeatureFlags, { onConflict: "key" });

  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .order("key", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listAnnouncements() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, audience, status, starts_at, ends_at, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function countRows(
  table: string,
  column?: string,
  values?: string[],
  gt?: { column: string; value: string },
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from(table).select("id", { count: "exact", head: true });

  if (column && values?.length) {
    query = query.in(column, values);
  }

  if (gt) {
    query = query.gt(gt.column, gt.value);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function removeContent({
  reason,
  subjectId,
  subjectType,
}: {
  reason: string;
  subjectId: string;
  subjectType: string;
}) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  if (subjectType === "message") {
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: now, status: "moderated", updated_at: now })
      .eq("id", subjectId);

    if (error) {
      throw error;
    }
  }

  if (subjectType === "square_post") {
    const { error } = await supabase
      .from("square_posts")
      .update({ deleted_at: now, status: "moderated", updated_at: now })
      .eq("id", subjectId);

    if (error) {
      throw error;
    }
  }

  if (subjectType === "square_comment") {
    const { error } = await supabase
      .from("square_comments")
      .update({ deleted_at: now, status: "moderated", updated_at: now })
      .eq("id", subjectId);

    if (error) {
      throw error;
    }
  }

  await supabase.from("moderation_cases").insert({
    details: reason,
    reason,
    status: "resolved",
    subject_id: subjectId,
    subject_type: subjectType,
  });
}

function formatReportRows(source: string, rows: unknown[]): ReportQueueItem[] {
  return rows.map((row) => ({
    created_at: String((row as { created_at?: unknown }).created_at ?? ""),
    reason: String((row as { reason?: unknown }).reason ?? "Report"),
    source,
    status: String((row as { status?: unknown }).status ?? "open"),
  }));
}

function parseList(value?: string) {
  return (value ?? "")
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
