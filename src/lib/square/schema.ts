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

const squarePostTypeAliases: Record<string, SquarePostType> = {
  anonymous: "anonymous_thought",
  anonymous_thought: "anonymous_thought",
  anonymous_thoughts: "anonymous_thought",
  "anonymous-thought": "anonymous_thought",
  "anonymous-thoughts": "anonymous_thought",
  "anonymous thought": "anonymous_thought",
  "anonymous thoughts": "anonymous_thought",
  photo: "photo",
  photos: "photo",
  poll: "poll",
  polls: "poll",
  question: "question",
  questions: "question",
  recommendation: "recommendation",
  recommendations: "recommendation",
  thought: "thought",
  thoughts: "thought",
};

export const squarePostTypeLabels: Record<SquarePostType, string> = {
  anonymous_thought: "Anonymous thought",
  photo: "Photo",
  poll: "Poll",
  question: "Question",
  recommendation: "Recommendation",
  thought: "Thought",
};

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) => (value === null || value === undefined ? undefined : value),
    z.string().trim().max(maxLength).optional(),
  );

const optionalStringArray = (maxItems: number, maxLength: number) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string") {
      return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return value;
  }, z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).optional());

const optionalBoolean = z.preprocess((value) => {
  if (typeof value === "string") {
    return value === "true";
  }

  return value;
}, z.boolean().optional());

const squarePostTypeSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");

  return squarePostTypeAliases[normalized] ?? value;
}, z.enum(squarePostTypeValues));

export const squarePostInputSchema = z.object({
  body: optionalText(1400),
  caption: optionalText(280),
  isAnonymous: optionalBoolean,
  pollOptions: optionalStringArray(4, 120),
  pollQuestion: optionalText(240),
  postType: squarePostTypeSchema,
  topics: optionalStringArray(6, 48),
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
