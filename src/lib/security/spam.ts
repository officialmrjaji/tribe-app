import type { OwnedProfile } from "@/lib/profile/service";
import { logger } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const spamPatterns = [
  /crypto\s+investment/i,
  /guaranteed\s+profit/i,
  /send\s+money/i,
  /whatsapp\s+only/i,
  /telegram\s+only/i,
  /click\s+this\s+link/i,
  /http:\/\/|https:\/\//i,
];

const harassmentPatterns = [
  /\bkill\b/i,
  /\bhate\b/i,
  /\bstupid\b/i,
  /\bidiot\b/i,
  /\bworthless\b/i,
];

export function detectSpamSignals(content: string) {
  const matchedSpam = spamPatterns.filter((pattern) => pattern.test(content));
  const matchedHarassment = harassmentPatterns.filter((pattern) =>
    pattern.test(content),
  );
  const score = Math.min(
    100,
    matchedSpam.length * 25 + matchedHarassment.length * 20,
  );

  return {
    score,
    signalType:
      matchedSpam.length && matchedHarassment.length
        ? "spam_and_harassment"
        : matchedSpam.length
          ? "spam"
          : matchedHarassment.length
            ? "harassment"
            : "none",
  };
}

export async function recordSpamSignal({
  content,
  contentType,
  ownedProfile,
}: {
  content: string;
  contentType: string;
  ownedProfile: OwnedProfile;
}) {
  const signal = detectSpamSignals(content);

  if (signal.score === 0) {
    return signal;
  }

  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("spam_signals").insert({
      content_excerpt: content.trim().slice(0, 500),
      content_type: contentType,
      metadata: {},
      profile_id: ownedProfile.profile.id,
      score: signal.score,
      signal_type: signal.signalType,
      user_id: ownedProfile.account.id,
    });
  } catch (error) {
    logger("warn", "Spam signal could not be recorded", {
      contentType,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return signal;
}
