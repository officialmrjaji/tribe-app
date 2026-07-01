import { z } from "zod";

export const moderationActionSchema = z.object({
  actionType: z.enum([
    "appeal_status_updated",
    "content_removed",
    "note",
    "shadow_banned",
    "user_banned",
    "user_suspended",
  ]),
  appealStatus: z
    .enum(["approved", "denied", "none", "reviewing", "submitted"])
    .optional(),
  caseId: z.string().uuid().optional(),
  durationDays: z.coerce.number().int().min(1).max(365).optional(),
  reason: z.string().trim().min(3).max(500),
  subjectId: z.string().uuid().optional(),
  subjectType: z
    .enum([
      "message",
      "profile",
      "square_comment",
      "square_post",
      "user",
      "voice_room",
      "voice_session",
    ])
    .default("user"),
  targetProfileId: z.string().uuid().optional(),
  targetUserId: z.string().uuid().optional(),
});

export const featureFlagUpdateSchema = z.object({
  description: z.string().trim().max(500).optional(),
  enabled: z.boolean(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_.-]+$/),
  name: z.string().trim().min(2).max(120),
  rolloutPercentage: z.coerce.number().int().min(0).max(100).default(0),
});

export const announcementCreateSchema = z.object({
  audience: z.enum(["admins", "all", "free", "premium"]).default("all"),
  body: z.string().trim().min(5).max(2000),
  endsAt: z.string().datetime().optional(),
  startsAt: z.string().datetime().optional(),
  status: z.enum(["archived", "draft", "published", "scheduled"]).default("draft"),
  title: z.string().trim().min(2).max(140),
});
