import { z } from "zod";

const nullableText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));

export const profileInputSchema = z.object({
  archetype: nullableText(120),
  avatarUrl: z.string().trim().url().nullable().optional(),
  bio: nullableText(1000),
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  city: nullableText(120),
  country: nullableText(120),
  discoverable: z.boolean().optional(),
  displayName: nullableText(120),
  region: nullableText(120),
  socialPace: nullableText(80),
  temperamentSummary: nullableText(240),
  visibility: z.enum(["private", "members", "discoverable"]).optional(),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
