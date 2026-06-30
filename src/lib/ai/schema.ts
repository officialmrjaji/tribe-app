import { z } from "zod";

export const aiProfileCoachInputSchema = z.object({
  bio: z.string().trim().max(1000).optional(),
  interests: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  prompts: z
    .array(
      z.object({
        answer: z.string().trim().max(240),
        promptText: z.string().trim().max(120),
      }),
    )
    .max(6)
    .optional(),
});

export const aiMatchCoachInputSchema = z
  .object({
    notes: z.string().trim().max(1000).optional(),
    profileId: z.string().uuid().optional(),
  })
  .refine((value) => value.profileId || value.notes, {
    message: "Choose a match or add match notes.",
  });

export const aiConversationCoachInputSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    focus: z
      .enum(["warm", "curious", "low_pressure", "direct"])
      .default("warm"),
    notes: z.string().trim().max(1000).optional(),
    profileId: z.string().uuid().optional(),
  })
  .refine((value) => value.conversationId || value.profileId || value.notes, {
    message: "Choose a conversation, match, or add context.",
  });

export const aiSafetyCheckInputSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  contentType: z
    .enum(["comment", "message", "other", "profile", "square_post"])
    .default("message"),
});

export type AIProfileCoachInput = z.infer<typeof aiProfileCoachInputSchema>;
export type AIMatchCoachInput = z.infer<typeof aiMatchCoachInputSchema>;
export type AIConversationCoachInput = z.infer<
  typeof aiConversationCoachInputSchema
>;
export type AISafetyCheckInput = z.infer<typeof aiSafetyCheckInputSchema>;

export type AIProfileCoachOutput = {
  improvedBio: string;
  improvedPrompts: Array<{
    answer: string;
    promptText: string;
  }>;
  notes: string[];
  suggestedInterests: string[];
};

export type AIMatchCoachOutput = {
  explanation: string;
  questionsToExplore: string[];
  scoreBreakdownNotes: Array<{
    area: string;
    note: string;
  }>;
};

export type AIConversationCoachOutput = {
  conversationStarters: string[];
  icebreakers: string[];
  notes: string[];
};

export type AISafetyCheckOutput = {
  categories: {
    harassment: boolean;
    scam: boolean;
    spam: boolean;
  };
  explanation: string;
  recommendation: string;
  riskLevel: "high" | "low" | "medium";
};
