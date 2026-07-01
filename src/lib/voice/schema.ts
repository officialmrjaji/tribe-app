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

export type CreateVoiceRoomInput = z.infer<typeof createVoiceRoomSchema>;
export type JoinVoiceRoomInput = z.infer<typeof joinVoiceRoomSchema>;
