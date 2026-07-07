import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { trackAnalyticsEvent } from "@/lib/analytics/service";
import { getSquareSession, squareErrorResponse } from "@/lib/square/api";
import { squarePostInputSchema } from "@/lib/square/schema";
import { createSquarePost } from "@/lib/square/service";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { recordSpamSignal } from "@/lib/security/spam";

export async function POST(request: Request) {
  try {
    const session = await getSquareSession();

    if ("response" in session) {
      return session.response;
    }

    const contentType = request.headers.get("content-type") ?? "";
    let imageFile: File | null = null;
    let payload: unknown;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const photo = formData.get("photo");
      imageFile = photo instanceof File && photo.size > 0 ? photo : null;
      payload = {
        body: String(formData.get("body") ?? ""),
        caption: String(formData.get("caption") ?? ""),
        isAnonymous: formData.get("isAnonymous") === "true",
        pollOptions: formData
          .getAll("pollOptions")
          .map((option) => String(option))
          .filter(Boolean),
        pollQuestion: String(formData.get("pollQuestion") ?? ""),
        postType: String(formData.get("postType") ?? "thought"),
        topics: String(formData.get("topics") ?? "")
          .split(",")
          .map((topic) => topic.trim())
          .filter(Boolean),
      };
    } else {
      payload = await request.json();
    }

    const parsedPayload = squarePostInputSchema.safeParse(payload);

    if (!parsedPayload.success) {
      const issueMessage = formatSquarePostValidationMessage(
        parsedPayload.error.issues,
      );

      return NextResponse.json(
        {
          error: issueMessage,
          issues: parsedPayload.error.issues,
        },
        { status: 400 },
      );
    }

    await assertRateLimit({
      action: "square_post_create",
      key: `square_post:${session.ownedProfile.account.id}`,
      limit: 20,
      route: "/api/square/posts",
      userId: session.ownedProfile.account.id,
      windowMs: 24 * 60 * 60 * 1000,
    });
    await recordSpamSignal({
      content: [
        parsedPayload.data.body,
        parsedPayload.data.caption,
        parsedPayload.data.pollQuestion,
      ]
        .filter(Boolean)
        .join(" "),
      contentType: "square_post",
      ownedProfile: session.ownedProfile,
    });

    const post = await createSquarePost({
      imageFile,
      input: parsedPayload.data,
      ownedProfile: session.ownedProfile,
    });
    await Promise.all([
      trackAnalyticsEvent({
        eventType: "square_post_created",
        ownedProfile: session.ownedProfile,
        properties: {
          isAnonymous: post.isAnonymous,
          postId: post.id,
          postType: post.postType,
        },
      }),
      trackAnalyticsEvent({
        eventType: "square_usage",
        ownedProfile: session.ownedProfile,
        properties: {
          action: "post_created",
          postType: post.postType,
        },
      }),
    ]);

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(error, {
        fallbackMessage: "Square post could not be created.",
        request,
      });
    }

    return squareErrorResponse(error, "Square post could not be created.");
  }
}

function formatSquarePostValidationMessage(
  issues: ReadonlyArray<{
    message: string;
    path: ReadonlyArray<PropertyKey>;
  }>,
) {
  const issue = issues[0];

  if (!issue) {
    return "Check your Square post details and try again.";
  }

  const field = issue.path.join(".");

  if (field === "postType") {
    return "Choose a supported Square post type: thoughts, photos, questions, anonymous thoughts, polls, or recommendations.";
  }

  if (field.startsWith("pollOptions")) {
    return "Polls support 2 to 4 options, each 120 characters or fewer.";
  }

  if (field.startsWith("topics")) {
    return "Use up to 6 topics or hashtags, each 48 characters or fewer.";
  }

  if (field === "body") {
    return "Main text must be 1,400 characters or fewer.";
  }

  if (field === "caption") {
    return "Photo captions must be 280 characters or fewer.";
  }

  if (field === "pollQuestion") {
    return "Poll questions must be 240 characters or fewer.";
  }

  return issue.message || "Check your Square post details and try again.";
}
