import { z } from "zod";

export const profileActionSchema = z.object({
  profileId: z.string().uuid(),
});

export const profileReportSchema = profileActionSchema.extend({
  details: z.string().trim().max(1000).optional(),
  reason: z.string().trim().min(3).max(120),
});

export type ProfileActionInput = z.infer<typeof profileActionSchema>;
export type ProfileReportInput = z.infer<typeof profileReportSchema>;
