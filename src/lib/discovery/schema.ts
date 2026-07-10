import { z } from "zod";
import { genderValues } from "@/lib/onboarding/options";

export const discoveryFiltersSchema = z
  .object({
    gender: z.enum(genderValues).optional(),
    maxAge: z.coerce.number().int().min(18).max(120).optional(),
    minAge: z.coerce.number().int().min(18).max(120).optional(),
  })
  .refine(
    (filters) =>
      !filters.minAge || !filters.maxAge || filters.minAge <= filters.maxAge,
    {
      message: "Minimum age must be lower than maximum age.",
      path: ["minAge"],
    },
  );

export const profileActionSchema = z.object({
  profileId: z.string().uuid(),
});

export const profileReportSchema = profileActionSchema.extend({
  details: z.string().trim().max(1000).optional(),
  reason: z.string().trim().min(3).max(120),
});

export type ProfileActionInput = z.infer<typeof profileActionSchema>;
export type DiscoveryFiltersInput = z.infer<typeof discoveryFiltersSchema>;
export type ProfileReportInput = z.infer<typeof profileReportSchema>;
