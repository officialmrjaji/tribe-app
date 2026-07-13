import type { OwnedProfile } from "@/lib/profile/service";
import { logger } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { hashValue } from "@/lib/security/hash";

export type AnalyticsEventType =
  | "ai_safety_check"
  | "conversation_started"
  | "daily_active_user"
  | "discovery_click"
  | "discovery_impression"
  | "match_created"
  | "message_reply"
  | "monthly_active_user"
  | "premium_conversion"
  | "profile_completed"
  | "profile_basic_ready"
  | "profile_completion_changed"
  | "profile_saved"
  | "session_ended"
  | "session_started"
  | "session_heartbeat"
  | "square_comment_created"
  | "square_post_created"
  | "square_usage"
  | "voice_room_created"
  | "voice_session_started"
  | "voice_usage";

export async function trackAnalyticsEvent({
  eventType,
  ownedProfile,
  properties = {},
  requestId,
  sessionId,
  source = "server",
}: {
  eventType: AnalyticsEventType;
  ownedProfile?: OwnedProfile | null;
  properties?: Record<string, unknown>;
  requestId?: string;
  sessionId?: string | null;
  source?: "client" | "server" | "webhook" | "worker";
}) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("analytics_events").insert({
      event_type: eventType,
      profile_id: ownedProfile?.profile.id ?? null,
      properties,
      request_id: requestId ?? null,
      session_id: sessionId ?? null,
      source,
      user_id: ownedProfile?.account.id ?? null,
    });
  } catch (error) {
    logger("debug", "Analytics event could not be recorded", {
      error: error instanceof Error ? error.message : String(error),
      eventType,
    });
  }
}

export async function recordSessionActivity({
  durationSeconds,
  ended,
  metadata = {},
  ownedProfile,
  request,
  sessionId,
}: {
  durationSeconds?: number;
  ended?: boolean;
  metadata?: Record<string, unknown>;
  ownedProfile: OwnedProfile;
  request?: Request;
  sessionId: string;
}) {
  const now = new Date().toISOString();
  const forwardedFor = request?.headers.get("x-forwarded-for")?.split(",")[0];
  const userAgent = request?.headers.get("user-agent");

  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("app_sessions").upsert(
      {
        duration_seconds: Math.max(0, Math.round(durationSeconds ?? 0)),
        ended_at: ended ? now : null,
        ip_hash: hashValue(forwardedFor),
        last_seen_at: now,
        metadata,
        profile_id: ownedProfile.profile.id,
        session_id: sessionId,
        user_agent_hash: hashValue(userAgent),
        user_id: ownedProfile.account.id,
      },
      { onConflict: "session_id" },
    );

    await Promise.all([
      trackAnalyticsEvent({
        eventType: ended ? "session_ended" : "session_heartbeat",
        ownedProfile,
        properties: { durationSeconds, ...metadata },
        sessionId,
        source: "client",
      }),
      trackAnalyticsEvent({
        eventType: "daily_active_user",
        ownedProfile,
        sessionId,
        source: "client",
      }),
      trackAnalyticsEvent({
        eventType: "monthly_active_user",
        ownedProfile,
        sessionId,
        source: "client",
      }),
    ]);
  } catch (error) {
    logger("debug", "Session analytics could not be recorded", {
      error: error instanceof Error ? error.message : String(error),
      sessionId,
    });
  }
}

export async function getAnalyticsOverview() {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const today = startOfDay(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString();
  const [
    dailyUsers,
    monthlyUsers,
    profileRows,
    discoveryImpressions,
    discoveryClicks,
    saves,
    matches,
    conversations,
    replies,
    voiceUsage,
    squareUsage,
    premiumConversions,
  ] = await Promise.all([
    fetchDistinctUsers("daily_active_user", today),
    fetchDistinctUsers("monthly_active_user", monthStart),
    supabase
      .from("profiles")
      .select("profile_completion_score")
      .limit(1000),
    countEvents("discovery_impression", sevenDaysAgo),
    countEvents("discovery_click", sevenDaysAgo),
    countEvents("profile_saved", sevenDaysAgo),
    countEvents("match_created", sevenDaysAgo),
    countEvents("conversation_started", sevenDaysAgo),
    countEvents("message_reply", sevenDaysAgo),
    countEvents("voice_usage", sevenDaysAgo),
    countEvents("square_usage", sevenDaysAgo),
    countEvents("premium_conversion", sevenDaysAgo),
  ]);

  if (profileRows.error) {
    throw profileRows.error;
  }

  const scores = ((profileRows.data ?? []) as Array<{
    profile_completion_score: number | null;
  }>)
    .map((row) => row.profile_completion_score ?? 0)
    .filter((score) => Number.isFinite(score));
  const averageProfileCompletion = scores.length
    ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
    : 0;

  return {
    averageProfileCompletion,
    conversationStarts7d: conversations,
    dailyActiveUsers: dailyUsers,
    discoveryClickRate7d:
      discoveryImpressions > 0
        ? Number(((discoveryClicks / discoveryImpressions) * 100).toFixed(1))
        : 0,
    discoveryClicks7d: discoveryClicks,
    discoveryImpressions7d: discoveryImpressions,
    matchRate7d:
      saves > 0 ? Number(((matches / saves) * 100).toFixed(1)) : 0,
    matches7d: matches,
    monthlyActiveUsers: monthlyUsers,
    premiumConversions7d: premiumConversions,
    replyRate7d:
      conversations > 0
        ? Number(((replies / conversations) * 100).toFixed(1))
        : 0,
    saves7d: saves,
    squareUsage7d: squareUsage,
    voiceUsage7d: voiceUsage,
  };
}

async function fetchDistinctUsers(eventType: AnalyticsEventType, since: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("analytics_events")
    .select("user_id")
    .eq("event_type", eventType)
    .gte("created_at", since)
    .not("user_id", "is", null)
    .limit(10000);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.user_id as string)).size;
}

async function countEvents(eventType: AnalyticsEventType, since: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType)
    .gte("created_at", since);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function startOfMonth(date: Date) {
  const nextDate = startOfDay(date);
  nextDate.setDate(1);

  return nextDate;
}
