import { z } from "zod";

export const conversationCreateSchema = z.object({
  profileId: z.string().uuid(),
});

export const messageInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(1000, "Message must be 1000 characters or fewer."),
});

export const conversationBlockSchema = z.object({
  reason: z.string().trim().max(240).optional(),
});

export const messageReportSchema = z.object({
  details: z.string().trim().max(1000).optional(),
  reason: z
    .string()
    .trim()
    .min(2, "Choose a report reason.")
    .max(240, "Report reason must be 240 characters or fewer."),
});

export type ConversationCreateInput = z.infer<typeof conversationCreateSchema>;
export type MessageInput = z.infer<typeof messageInputSchema>;
export type MessageReportInput = z.infer<typeof messageReportSchema>;
