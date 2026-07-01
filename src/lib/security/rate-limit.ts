import { rateLimited } from "@/lib/api/errors";
import { logger } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  action: string;
  key: string;
  limit: number;
  route?: string;
  userId?: string | null;
  windowMs: number;
};

const buckets = new Map<string, Bucket>();

export async function assertRateLimit({
  action,
  key,
  limit,
  route,
  userId,
  windowMs,
}: RateLimitInput) {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, limit - bucket.count);
  const blocked = bucket.count > limit;

  await recordRateLimitEvent({
    action,
    blocked,
    key,
    limit,
    remaining,
    resetAt: bucket.resetAt,
    route,
    userId,
  });

  if (blocked) {
    throw rateLimited("Too many requests. Please slow down and try again.");
  }

  return {
    limit,
    remaining,
    resetAt: new Date(bucket.resetAt).toISOString(),
  };
}

async function recordRateLimitEvent({
  action,
  blocked,
  key,
  limit,
  remaining,
  resetAt,
  route,
  userId,
}: {
  action: string;
  blocked: boolean;
  key: string;
  limit: number;
  remaining: number;
  resetAt: number;
  route?: string;
  userId?: string | null;
}) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("rate_limit_events").insert({
      action,
      blocked,
      key,
      limit_count: limit,
      remaining,
      reset_at: new Date(resetAt).toISOString(),
      route: route ?? null,
      user_id: userId ?? null,
    });
  } catch (error) {
    logger("debug", "Rate limit event could not be persisted", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
