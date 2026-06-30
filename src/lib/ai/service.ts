import { getDiscoveryRecommendations } from "@/lib/discovery/service";
import { getConversationMessages } from "@/lib/messaging/service";
import {
  availabilityLabels,
  conversationStyleLabels,
  intentLabels,
  interestLabels,
  interestValues,
  lifestyleSignalLabels,
  personalityTypeLabels,
} from "@/lib/onboarding/options";
import { getOnboardingStatus } from "@/lib/onboarding/service";
import type { OwnedProfile } from "@/lib/profile/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createStructuredAIResponse } from "./openai";
import type {
  AIConversationCoachInput,
  AIConversationCoachOutput,
  AIMatchCoachInput,
  AIMatchCoachOutput,
  AIProfileCoachInput,
  AIProfileCoachOutput,
  AISafetyCheckInput,
  AISafetyCheckOutput,
} from "./schema";

export class AICompanionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AICompanionError";
    this.status = status;
  }
}

const baseSystemPrompt = [
  "You are TribeApp's optional AI Companion.",
  "TribeApp is a personality-first social discovery product, not a content automation tool.",
  "Keep suggestions calm, specific, consent-aware, and in the user's voice.",
  "Never claim certainty about another person. Never write as if a message was sent.",
  "Return only JSON that matches the requested schema.",
].join(" ");

const profileCoachJSONSchema = {
  additionalProperties: false,
  properties: {
    improvedBio: { maxLength: 700, type: "string" },
    improvedPrompts: {
      items: {
        additionalProperties: false,
        properties: {
          answer: { maxLength: 240, type: "string" },
          promptText: { maxLength: 120, type: "string" },
        },
        required: ["promptText", "answer"],
        type: "object",
      },
      maxItems: 3,
      type: "array",
    },
    notes: {
      items: { maxLength: 160, type: "string" },
      maxItems: 4,
      type: "array",
    },
    suggestedInterests: {
      items: { enum: [...interestValues], type: "string" },
      maxItems: 6,
      type: "array",
    },
  },
  required: ["improvedBio", "improvedPrompts", "suggestedInterests", "notes"],
  type: "object",
};

const matchCoachJSONSchema = {
  additionalProperties: false,
  properties: {
    explanation: { maxLength: 800, type: "string" },
    questionsToExplore: {
      items: { maxLength: 180, type: "string" },
      maxItems: 4,
      type: "array",
    },
    scoreBreakdownNotes: {
      items: {
        additionalProperties: false,
        properties: {
          area: { maxLength: 80, type: "string" },
          note: { maxLength: 180, type: "string" },
        },
        required: ["area", "note"],
        type: "object",
      },
      maxItems: 5,
      type: "array",
    },
  },
  required: ["explanation", "scoreBreakdownNotes", "questionsToExplore"],
  type: "object",
};

const conversationCoachJSONSchema = {
  additionalProperties: false,
  properties: {
    conversationStarters: {
      items: { maxLength: 220, type: "string" },
      maxItems: 5,
      type: "array",
    },
    icebreakers: {
      items: { maxLength: 160, type: "string" },
      maxItems: 5,
      type: "array",
    },
    notes: {
      items: { maxLength: 180, type: "string" },
      maxItems: 4,
      type: "array",
    },
  },
  required: ["conversationStarters", "icebreakers", "notes"],
  type: "object",
};

const safetyCheckJSONSchema = {
  additionalProperties: false,
  properties: {
    categories: {
      additionalProperties: false,
      properties: {
        harassment: { type: "boolean" },
        scam: { type: "boolean" },
        spam: { type: "boolean" },
      },
      required: ["spam", "harassment", "scam"],
      type: "object",
    },
    explanation: { maxLength: 500, type: "string" },
    recommendation: { maxLength: 300, type: "string" },
    riskLevel: { enum: ["low", "medium", "high"], type: "string" },
  },
  required: ["riskLevel", "categories", "explanation", "recommendation"],
  type: "object",
};

export async function generateProfileCoachSuggestions({
  input,
  ownedProfile,
}: {
  input: AIProfileCoachInput;
  ownedProfile: OwnedProfile;
}) {
  const onboarding = await getOnboardingStatus(ownedProfile.profile.id);
  const prompt = [
    "Improve this member's profile without changing their intent or identity.",
    "Produce one improved bio, improved prompt answers, and interest suggestions from the allowed interest slugs only.",
    "Do not over-polish. Do not add claims not present in the input.",
    "",
    `Profile: ${JSON.stringify(buildProfileContext(ownedProfile))}`,
    `Onboarding: ${JSON.stringify(formatOnboarding(onboarding.response))}`,
    `Draft input: ${JSON.stringify(input)}`,
    `Allowed interest slugs: ${interestValues.join(", ")}`,
  ].join("\n");
  const { model, output } =
    await createStructuredAIResponse<AIProfileCoachOutput>({
      schema: profileCoachJSONSchema,
      schemaName: "tribe_profile_coach",
      system: baseSystemPrompt,
      user: prompt,
    });

  await recordAISuggestion({
    featureType: "profile_coach",
    inputSummary: summarizeText(input.bio ?? ownedProfile.profile.bio ?? ""),
    model,
    output,
    ownedProfile,
  });

  return output;
}

export async function generateMatchCoachExplanation({
  input,
  ownedProfile,
}: {
  input: AIMatchCoachInput;
  ownedProfile: OwnedProfile;
}) {
  const matchContext = input.profileId
    ? await getMatchContext(ownedProfile, input.profileId)
    : null;
  const prompt = [
    "Explain why this match may be worth exploring.",
    "Use the provided match signals only. Avoid destiny language, pressure, or guarantees.",
    "Include a better human-readable explanation, score breakdown notes, and optional questions to explore.",
    "",
    `Viewer profile: ${JSON.stringify(buildProfileContext(ownedProfile))}`,
    `Match context: ${JSON.stringify(matchContext)}`,
    `Additional notes: ${input.notes ?? ""}`,
  ].join("\n");
  const { model, output } =
    await createStructuredAIResponse<AIMatchCoachOutput>({
      schema: matchCoachJSONSchema,
      schemaName: "tribe_match_coach",
      system: baseSystemPrompt,
      user: prompt,
    });

  await recordAISuggestion({
    featureType: "match_coach",
    inputSummary: summarizeText(input.notes ?? matchContext?.name ?? ""),
    model,
    output,
    ownedProfile,
  });

  return output;
}

export async function generateConversationCoachSuggestions({
  input,
  ownedProfile,
}: {
  input: AIConversationCoachInput;
  ownedProfile: OwnedProfile;
}) {
  const conversationContext = input.conversationId
    ? await getConversationContext(ownedProfile, input.conversationId)
    : null;
  const matchContext = input.profileId
    ? await getMatchContext(ownedProfile, input.profileId)
    : null;
  const prompt = [
    "Suggest conversation starters and icebreakers.",
    "Do not write a message that pretends to be sent. Keep suggestions optional and editable.",
    "Avoid pickup-artist framing, pressure, or overly intimate assumptions.",
    "",
    `Preferred tone: ${input.focus}`,
    `Viewer profile: ${JSON.stringify(buildProfileContext(ownedProfile))}`,
    `Conversation context: ${JSON.stringify(conversationContext)}`,
    `Match context: ${JSON.stringify(matchContext)}`,
    `Additional notes: ${input.notes ?? ""}`,
  ].join("\n");
  const { model, output } =
    await createStructuredAIResponse<AIConversationCoachOutput>({
      schema: conversationCoachJSONSchema,
      schemaName: "tribe_conversation_coach",
      system: baseSystemPrompt,
      user: prompt,
    });

  await recordAISuggestion({
    featureType: "conversation_coach",
    inputSummary: summarizeText(input.notes ?? conversationContext?.title ?? ""),
    model,
    output,
    ownedProfile,
  });

  return output;
}

export async function runAISafetyCheck({
  input,
  ownedProfile,
}: {
  input: AISafetyCheckInput;
  ownedProfile: OwnedProfile;
}) {
  const prompt = [
    "Detect whether the content appears to contain spam, harassment, or scam signals.",
    "This is advisory safety support. Do not punish users. Provide a short recommendation for a human/user action.",
    "",
    `Content type: ${input.contentType}`,
    `Content: ${input.content}`,
  ].join("\n");
  const { model, output } =
    await createStructuredAIResponse<AISafetyCheckOutput>({
      schema: safetyCheckJSONSchema,
      schemaName: "tribe_safety_check",
      system: baseSystemPrompt,
      user: prompt,
    });

  await Promise.all([
    recordAISuggestion({
      featureType: "safety_check",
      inputSummary: summarizeText(input.content),
      model,
      output,
      ownedProfile,
    }),
    recordSafetyCheck({
      input,
      output,
      ownedProfile,
    }),
  ]);

  return output;
}

async function getMatchContext(ownedProfile: OwnedProfile, profileId: string) {
  const discovery = await getDiscoveryRecommendations(ownedProfile);

  if (!discovery.completed) {
    throw new AICompanionError("Complete onboarding before using match coaching.", 409);
  }

  const match = discovery.profiles.find((profile) => profile.id === profileId);

  if (!match) {
    throw new AICompanionError(
      "This profile is not available in your current discovery set.",
      404,
    );
  }

  return {
    availability: match.availability,
    matchScore: match.match,
    name: match.name,
    personalitySummary: match.personalitySummary,
    reasons: match.reasons,
    scoreBreakdown: match.scoreBreakdown,
    sharedGoals: match.sharedGoals,
    sharedInterests: match.sharedInterests,
  };
}

async function getConversationContext(
  ownedProfile: OwnedProfile,
  conversationId: string,
) {
  const thread = await getConversationMessages(ownedProfile, conversationId, {
    limit: 12,
  });
  const participant = thread.conversation.otherParticipants[0];

  return {
    lastMessages: thread.messages.slice(-6).map((message) => ({
      body: message.body,
      isMine: message.isMine,
      sender: message.isMine ? "me" : "them",
    })),
    title: participant?.name ?? "Conversation",
  };
}

async function recordAISuggestion({
  featureType,
  inputSummary,
  model,
  output,
  ownedProfile,
}: {
  featureType: "conversation_coach" | "match_coach" | "profile_coach" | "safety_check";
  inputSummary: string;
  model: string;
  output: unknown;
  ownedProfile: OwnedProfile;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("ai_suggestions").insert({
    feature_type: featureType,
    input_summary: inputSummary,
    model,
    output,
    profile_id: ownedProfile.profile.id,
    user_id: ownedProfile.account.id,
  });

  if (error) {
    throw error;
  }
}

async function recordSafetyCheck({
  input,
  output,
  ownedProfile,
}: {
  input: AISafetyCheckInput;
  output: AISafetyCheckOutput;
  ownedProfile: OwnedProfile;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("ai_safety_checks").insert({
    categories: output.categories,
    content_type: input.contentType,
    input_excerpt: summarizeText(input.content, 500),
    profile_id: ownedProfile.profile.id,
    recommendation: output.recommendation,
    risk_level: output.riskLevel,
    user_id: ownedProfile.account.id,
  });

  if (error) {
    throw error;
  }
}

function buildProfileContext(ownedProfile: OwnedProfile) {
  return {
    bio: ownedProfile.profile.bio,
    city: ownedProfile.profile.city,
    country: ownedProfile.profile.country,
    displayName: ownedProfile.profile.display_name,
    profileCompletionScore: ownedProfile.profile.profile_completion_score,
    socialPace: ownedProfile.profile.social_pace,
    temperamentSummary: ownedProfile.profile.temperament_summary,
  };
}

function formatOnboarding(
  onboarding: Awaited<ReturnType<typeof getOnboardingStatus>>["response"],
) {
  if (!onboarding) {
    return null;
  }

  return {
    availability: availabilityLabels[onboarding.availability],
    conversationStyle:
      conversationStyleLabels[onboarding.conversationStyle],
    intent: intentLabels[onboarding.intent],
    interests: onboarding.interests.map((interest) => interestLabels[interest]),
    lifestyleSignals: onboarding.lifestyleSignals.map(
      (signal) => lifestyleSignalLabels[signal],
    ),
    personalityType: personalityTypeLabels[onboarding.personalityType],
    primaryGoal: onboarding.primaryGoal,
  };
}

function summarizeText(value: string, maxLength = 220) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
}
