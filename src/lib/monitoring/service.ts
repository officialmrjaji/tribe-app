import { logger, logError } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function recordApplicationMetric({
  dimensions = {},
  metricKey,
  metricValue,
}: {
  dimensions?: Record<string, unknown>;
  metricKey: string;
  metricValue: number;
}) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("application_metrics").insert({
      dimensions,
      metric_key: metricKey,
      metric_value: metricValue,
    });
  } catch (error) {
    logger("debug", "Application metric could not be persisted", {
      error: error instanceof Error ? error.message : String(error),
      metricKey,
    });
  }
}

export async function captureException({
  context = {},
  error,
  requestId,
}: {
  context?: Record<string, unknown>;
  error: unknown;
  requestId?: string;
}) {
  logError("Captured application exception", error, {
    ...context,
    requestId,
  });

  await recordApplicationMetric({
    dimensions: {
      ...context,
      requestId,
    },
    metricKey: "application.exception",
    metricValue: 1,
  });
}
