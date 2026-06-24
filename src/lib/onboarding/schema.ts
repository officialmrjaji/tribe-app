import { z } from "zod";
import {
  availabilityValues,
  conversationStyleValues,
  intentValues,
  interestValues,
  lifestyleSignalValues,
  personalityTypeValues,
} from "./options";

export const onboardingInputSchema = z.object({
  availability: z.enum(availabilityValues),
  conversationStyle: z.enum(conversationStyleValues),
  intent: z.enum(intentValues),
  interests: z.array(z.enum(interestValues)).min(3).max(12),
  lifestyleSignals: z.array(z.enum(lifestyleSignalValues)).min(2).max(8),
  personalityType: z.enum(personalityTypeValues),
  primaryGoal: z.string().trim().min(8).max(180),
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
