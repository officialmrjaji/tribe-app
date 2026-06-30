import { z } from "zod";

export const squarePostTypeValues = [
  "thought",
  "photo",
  "question",
  "anonymous_thought",
  "poll",
  "recommendation",
] as const;

export type SquarePostType = (typeof squarePostTypeValues)[number];

export const squarePostTypeLabels: Record<SquarePostType, string> = {
  anonymous_thought: "Anonymous thought",
  photo: "Photo",
  poll: "Poll",
  question: "Question",
  recommendation: "Recommendation",
  thought: "Thought",
};

export const squarePostInputSchema = z.object({
  body: z.string().trim().max(1400).optional(),
  caption: z.string().trim().max(280).optional(),
  isAnonymous: z.boolean().optional(),
  pollOptions: z.array(z.string().trim().min(1).max(120)).max(4).optional(),
  pollQuestion: z.string().trim().max(240).optional(),
  postType: z.enum(squarePostTypeValues),
  topics: z.array(z.string().trim().min(1).max(48)).max(6).optional(),
});

export const squareCommentInputSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export const squareRepostInputSchema = z.object({
  commentary: z.string().trim().max(280).optional(),
});

export const squareReportInputSchema = z.object({
  details: z.string().trim().max(1000).optional(),
  reason: z.string().trim().min(2).max(120),
});

export const squarePollVoteInputSchema = z.object({
  optionId: z.string().uuid(),
});

export type SquarePostInput = z.infer<typeof squarePostInputSchema>;
