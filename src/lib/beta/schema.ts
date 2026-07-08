import { z } from "zod";

export const betaInviteSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, "Enter the complete invite code.")
    .max(64, "Invite codes cannot exceed 64 characters."),
});

export const betaFeedbackSchema = z.object({
  category: z.enum([
    "bug",
    "confusing",
    "idea",
    "performance",
    "safety",
    "other",
  ]),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more so we can act on your feedback.")
    .max(2000, "Feedback cannot exceed 2,000 characters."),
  rating: z.coerce.number().int().min(1).max(5),
  screenshotOrLink: z
    .string()
    .trim()
    .max(500, "The screenshot or link field cannot exceed 500 characters.")
    .refine(
      (value) => !value || /^https?:\/\/\S+$/i.test(value),
      "Enter a complete http or https link.",
    )
    .optional()
    .default(""),
});

export type BetaFeedbackInput = z.infer<typeof betaFeedbackSchema>;
