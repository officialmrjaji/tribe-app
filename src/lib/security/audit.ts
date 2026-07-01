import type { OwnedProfile } from "@/lib/profile/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/observability/logger";
import { hashValue } from "./hash";

export type SecuritySeverity = "critical" | "info" | "warning";

export async function recordSecurityAuditEvent({
  eventType,
  metadata = {},
  ownedProfile,
  request,
  requestId,
  severity = "info",
}: {
  eventType: string;
  metadata?: Record<string, unknown>;
  ownedProfile?: OwnedProfile | null;
  request?: Request;
  requestId?: string;
  severity?: SecuritySeverity;
}) {
  try {
    const supabase = createSupabaseAdminClient();
    const forwardedFor = request?.headers.get("x-forwarded-for")?.split(",")[0];
    const userAgent = request?.headers.get("user-agent");
    await supabase.from("security_audit_log").insert({
      event_type: eventType,
      ip_hash: hashValue(forwardedFor),
      metadata,
      profile_id: ownedProfile?.profile.id ?? null,
      request_id: requestId ?? null,
      severity,
      user_agent_hash: hashValue(userAgent),
      user_id: ownedProfile?.account.id ?? null,
    });
  } catch (error) {
    logger("warn", "Security audit event could not be recorded", {
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function recordModerationAudit({
  action,
  actorClerkUserId,
  actorUserId,
  metadata = {},
  requestId,
  targetId,
  targetType,
}: {
  action: string;
  actorClerkUserId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  requestId?: string;
  targetId?: string | null;
  targetType: string;
}) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("moderation_audit_log").insert({
      action,
      actor_clerk_user_id: actorClerkUserId ?? null,
      actor_user_id: actorUserId ?? null,
      metadata,
      request_id: requestId ?? null,
      target_id: targetId ?? null,
      target_type: targetType,
    });
  } catch (error) {
    logger("warn", "Moderation audit event could not be recorded", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
