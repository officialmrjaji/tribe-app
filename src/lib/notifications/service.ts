import type { OwnedProfile } from "@/lib/profile/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type NotificationType =
  | "conversation_created"
  | "mutual_save"
  | "new_message"
  | "profile_saved";

export type NotificationRecord = {
  actorName: string | null;
  createdAt: string;
  data: Record<string, unknown>;
  entityId: string | null;
  entityType: "conversation" | "match" | "message" | "profile";
  href: string;
  id: string;
  isRead: boolean;
  message: string;
  title: string;
  type: NotificationType;
};

type NotificationRow = {
  actor_user_id: string | null;
  created_at: string;
  data: Record<string, unknown>;
  entity_id: string | null;
  entity_type: "conversation" | "match" | "message" | "profile";
  id: string;
  read_at: string | null;
  recipient_user_id: string;
  type: NotificationType;
};

type ProfileSummaryRow = {
  avatar_url: string | null;
  display_name: string | null;
  user_id: string;
};

export async function createNotification({
  actorUserId,
  data,
  dedupeKey,
  entityId,
  entityType,
  recipientUserId,
  type,
}: {
  actorUserId?: string | null;
  data?: Record<string, unknown>;
  dedupeKey?: string;
  entityId?: string | null;
  entityType: NotificationRecord["entityType"];
  recipientUserId: string;
  type: NotificationType;
}) {
  if (actorUserId && actorUserId === recipientUserId) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const payload = {
    actor_user_id: actorUserId ?? null,
    data: data ?? {},
    dedupe_key: dedupeKey ?? null,
    entity_id: entityId ?? null,
    entity_type: entityType,
    recipient_user_id: recipientUserId,
    type,
  };

  const result = dedupeKey
    ? await supabase
        .from("notifications")
        .upsert(payload, {
          ignoreDuplicates: true,
          onConflict: "dedupe_key",
        })
        .select("id")
        .maybeSingle()
    : await supabase
        .from("notifications")
        .insert(payload)
        .select("id")
        .single();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function listNotifications(
  ownedProfile: OwnedProfile,
  limit = 40,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_user_id", ownedProfile.account.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as NotificationRow[];
  const actorUserIds = Array.from(
    new Set(rows.map((row) => row.actor_user_id).filter(Boolean) as string[]),
  );
  const actorProfiles = await fetchProfilesByUserIds(actorUserIds);
  const unreadCount = await getUnreadNotificationCount(ownedProfile);

  return {
    notifications: rows.map((row) =>
      formatNotification(row, actorProfiles.get(row.actor_user_id ?? "")),
    ),
    unreadCount,
  };
}

export async function getUnreadNotificationCount(ownedProfile: OwnedProfile) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", ownedProfile.account.id)
    .is("read_at", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function markNotificationRead(
  ownedProfile: OwnedProfile,
  notificationId: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_user_id", ownedProfile.account.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Notification not found.");
  }

  return { notificationId, read: true };
}

export async function markAllNotificationsRead(ownedProfile: OwnedProfile) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", ownedProfile.account.id)
    .is("read_at", null);

  if (error) {
    throw error;
  }

  return { read: true };
}

async function fetchProfilesByUserIds(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ProfileSummaryRow>();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as ProfileSummaryRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );
}

function formatNotification(
  row: NotificationRow,
  actorProfile?: ProfileSummaryRow,
): NotificationRecord {
  const actorName = actorProfile?.display_name ?? null;
  const displayName = actorName ?? "Someone";
  const conversationId = stringFromData(row.data, "conversationId");
  const profileId = stringFromData(row.data, "profileId");

  if (row.type === "new_message") {
    return {
      ...baseNotification(row, actorName),
      href: conversationId ? `/messages/${conversationId}` : "/messages",
      message: `${displayName} sent you a message.`,
      title: "New message",
    };
  }

  if (row.type === "mutual_save") {
    return {
      ...baseNotification(row, actorName),
      href: profileId ? "/explore?tab=matches" : "/explore?tab=matches",
      message: `You and ${displayName} liked each other. Messaging is now available.`,
      title: "Mutual like",
    };
  }

  if (row.type === "profile_saved") {
    return {
      ...baseNotification(row, actorName),
      href: "/explore?tab=liked-me",
      message: `${displayName} liked your profile.`,
      title: "Profile liked",
    };
  }

  return {
    ...baseNotification(row, actorName),
    href: conversationId ? `/messages/${conversationId}` : "/messages",
    message: `${displayName} opened a conversation with you.`,
    title: "Conversation started",
  };
}

function baseNotification(row: NotificationRow, actorName: string | null) {
  return {
    actorName,
    createdAt: row.created_at,
    data: row.data ?? {},
    entityId: row.entity_id,
    entityType: row.entity_type,
    id: row.id,
    isRead: Boolean(row.read_at),
    type: row.type,
  };
}

function stringFromData(data: Record<string, unknown>, key: string) {
  const value = data?.[key];

  return typeof value === "string" ? value : null;
}
