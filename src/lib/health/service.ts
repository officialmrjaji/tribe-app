import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/feature-flags";

export type HealthComponentStatus = "degraded" | "healthy" | "unhealthy";

export type HealthCheckResult = {
  checkedAt: string;
  components: Record<
    "ai" | "authentication" | "beta" | "database" | "payments" | "storage" | "voice",
    {
      message: string;
      status: HealthComponentStatus;
    }
  >;
  status: "healthy" | "unhealthy";
};

export async function getHealthStatus(): Promise<HealthCheckResult> {
  const checkedAt = new Date().toISOString();
  const [beta, database, storage, voice] = await Promise.all([
    checkBetaAccess(),
    checkDatabase(),
    checkStorage(),
    checkVoice(),
  ]);
  const components = {
    ai: isFeatureEnabled("ai")
      ? checkEnvironmentPair({
          label: "AI service",
          optional: false,
          variables: ["OPENAI_API_KEY"],
        })
      : {
          message: "AI Companion is intentionally disabled for private beta.",
          status: "degraded" as const,
        },
    authentication: checkEnvironmentPair({
      label: "Authentication",
      variables: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    }),
    beta,
    database,
    payments:
      isFeatureEnabled("premium") && isFeatureEnabled("payments")
        ? checkEnvironmentPair({
            label: "Payment",
            variables: ["NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY", "PAYSTACK_SECRET_KEY"],
          })
        : {
            message: "Premium payments are intentionally disabled for private beta.",
            status: "degraded" as const,
          },
    storage,
    voice,
  };
  const status = Object.values(components).some(
    (component) => component.status === "unhealthy",
  )
    ? "unhealthy"
    : "healthy";

  return {
    checkedAt,
    components,
    status,
  };
}

async function checkBetaAccess() {
  try {
    const supabase = createSupabaseAdminClient();
    const [inviteCodes, feedback] = await Promise.all([
      supabase.from("invite_codes").select("id").limit(1),
      supabase.from("beta_feedback").select("id").limit(1),
    ]);

    if (inviteCodes.error) {
      throw inviteCodes.error;
    }

    if (feedback.error) {
      throw feedback.error;
    }

    return {
      message: "Private beta access and feedback tables are reachable.",
      status: "healthy" as const,
    };
  } catch (error) {
    return {
      message: getErrorMessage(error),
      status: "unhealthy" as const,
    };
  }
}

async function checkDatabase() {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("users").select("id").limit(1);

    if (error) {
      throw error;
    }

    return {
      message: "Database query succeeded.",
      status: "healthy" as const,
    };
  } catch (error) {
    return {
      message: getErrorMessage(error),
      status: "unhealthy" as const,
    };
  }
}

async function checkStorage() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      throw error;
    }

    const bucketNames = new Set((data ?? []).map((bucket) => bucket.name));
    const missing = ["profile-media", "square-media"].filter(
      (bucket) => !bucketNames.has(bucket),
    );

    return missing.length
      ? {
          message: `Missing buckets: ${missing.join(", ")}.`,
          status: "unhealthy" as const,
        }
      : {
          message: "Required storage buckets are available.",
          status: "healthy" as const,
        };
  } catch (error) {
    return {
      message: getErrorMessage(error),
      status: "unhealthy" as const,
    };
  }
}

async function checkVoice() {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("voice_rooms").select("id").limit(1);

    if (error) {
      throw error;
    }

    return {
      message: "Voice tables are reachable.",
      status: "healthy" as const,
    };
  } catch (error) {
    return {
      message: getErrorMessage(error),
      status: "unhealthy" as const,
    };
  }
}

function checkEnvironmentPair({
  label,
  optional,
  variables,
}: {
  label: string;
  optional?: boolean;
  variables: string[];
}) {
  const missing = variables.filter((variable) => !process.env[variable]);

  if (missing.length === 0) {
    return {
      message: `${label} environment variables are configured.`,
      status: "healthy" as const,
    };
  }

  return {
    message: `Missing ${label} variables: ${missing.join(", ")}.`,
    status: optional ? ("degraded" as const) : ("unhealthy" as const),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error);
}
