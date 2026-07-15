import { z } from "zod";

const nullableText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value ? value : null));

export const createVoiceRoomSchema = z
  .object({
    description: nullableText(400),
    language: nullableText(80),
    maxParticipants: z.number().int().min(2).max(50).default(12),
    roomType: z.enum(["private", "public", "scheduled"]).default("public"),
    scheduledAt: z.string().datetime().nullable().optional(),
    title: z.string().trim().min(3).max(120),
    topic: nullableText(120),
  })
  .refine(
    (value) => value.roomType !== "scheduled" || Boolean(value.scheduledAt),
    {
      message: "Scheduled rooms need a scheduled time.",
      path: ["scheduledAt"],
    },
  );

export const joinVoiceRoomSchema = z.object({
  inviteCode: z.string().trim().max(120).optional(),
});

export const voiceRoomActionSchema = z.object({
  action: z.enum([
    "approve_speaker",
    "cancel_raise_hand",
    "demote_moderator",
    "end_room",
    "leave_room",
    "lock_room",
    "promote_moderator",
    "raise_hand",
    "reject_speaker",
    "remove_participant",
    "unlock_room",
  ]),
  targetUserId: z.string().uuid().optional(),
});

export const voiceRoomChatInputSchema = z.object({
  body: z.string().trim().min(1).max(500),
  clientMessageId: z.string().trim().max(80).optional(),
});

export const voiceRoomChatReportSchema = z.object({
  details: z.string().trim().max(1000).optional(),
  reason: z
    .string()
    .trim()
    .min(2, "Choose a report reason.")
    .max(240, "Report reason must be 240 characters or fewer."),
});

export type CreateVoiceRoomInput = z.infer<typeof createVoiceRoomSchema>;
export type JoinVoiceRoomInput = z.infer<typeof joinVoiceRoomSchema>;
export type VoiceRoomActionInput = z.infer<typeof voiceRoomActionSchema>;
export type VoiceRoomChatInput = z.infer<typeof voiceRoomChatInputSchema>;
export type VoiceRoomChatReportInput = z.infer<
  typeof voiceRoomChatReportSchema
>;
