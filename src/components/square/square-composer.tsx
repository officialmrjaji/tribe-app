"use client";

import {
  ArrowLeft,
  Camera,
  Check,
  HelpCircle,
  LoaderCircle,
  MessageSquareText,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  squarePostTypeLabels,
  squarePostTypeValues,
  type SquarePostType,
} from "@/lib/square/schema";

const postTypes = squarePostTypeValues;

type SquarePostErrorPayload = {
  error?: string;
  issues?: Array<{
    message?: string;
    path?: Array<string | number>;
  }>;
};

export function SquareComposer() {
  const router = useRouter();
  const [postType, setPostType] = useState<SquarePostType>("thought");
  const [body, setBody] = useState("");
  const [caption, setCaption] = useState("");
  const [topics, setTopics] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const isAnonymousMode = postType === "anonymous_thought";
  const helperText = useMemo(() => {
    if (isAnonymousMode) {
      return "Anonymous posts are text-only, rate-limited, and still visible to moderators.";
    }

    if (postType === "poll") {
      return "Polls are single-choice for MVP and work best with 2 to 4 calm options.";
    }

    if (postType === "photo") {
      return "Photo posts support one image for MVP. Keep it activity, place, or recommendation focused.";
    }

    return "Use Square for context, questions, recommendations, and thoughtful social signals.";
  }, [isAnonymousMode, postType]);

  function updatePostType(nextType: SquarePostType) {
    setPostType(nextType);
    setError("");

    if (nextType === "anonymous_thought") {
      setPhoto(null);
    }
  }

  function updatePollOption(index: number, value: string) {
    setPollOptions((currentOptions) =>
      currentOptions.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    );
  }

  function addPollOption() {
    setPollOptions((currentOptions) =>
      currentOptions.length >= 4 ? currentOptions : [...currentOptions, ""],
    );
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("body", body);
      formData.append("caption", caption);
      formData.append("isAnonymous", String(isAnonymousMode));
      formData.append("pollQuestion", pollQuestion);
      formData.append("postType", postType);
      formData.append("topics", topics);
      pollOptions
        .map((option) => option.trim())
        .filter(Boolean)
        .forEach((option) => formData.append("pollOptions", option));

      if (photo && !isAnonymousMode) {
        formData.append("photo", photo);
      }

      const response = await fetch("/api/square/posts", {
        body: formData,
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Square post could not be created."),
        );
      }

      router.push(`/square/posts/${payload.post.id}`);
    } catch (postError) {
      setError(
        postError instanceof Error
          ? postError.message
          : "Square post could not be created.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-[#d8ded1] pb-5">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
            href="/square"
          >
            <ArrowLeft size={16} />
            Square
          </Link>
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
            <MessageSquareText size={16} />
            Create post
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Start a calm community thread.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
            Share something that helps people understand how you think, what you
            enjoy, or what kind of connection you are open to.
          </p>
        </header>

        <form
          className="mt-6 space-y-5 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm"
          onSubmit={submitPost}
        >
          <div>
            <p className="text-sm font-semibold text-[#607265]">Post type</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {postTypes.map((type) => (
                <button
                  className={[
                    "min-h-10 rounded-md border px-3 text-sm font-semibold transition",
                    postType === type
                      ? "border-[#17251f] bg-[#17251f] text-white"
                      : "border-[#cbd4c6] bg-[#fbfaf4] text-[#34443a] hover:bg-[#f3f0e6]",
                  ].join(" ")}
                  key={type}
                  onClick={() => updatePostType(type)}
                  type="button"
                >
                  {squarePostTypeLabels[type]}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-[#34443a]">
              Main text
            </span>
            <textarea
              className="mt-2 min-h-36 w-full rounded-md border border-[#cbd4c6] bg-white px-3 py-3 text-sm leading-6 text-[#17201b] outline-none transition focus:border-[#17251f]"
              maxLength={1400}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Share a thought, question, recommendation, or context..."
              value={body}
            />
          </label>

          {postType === "photo" ? (
            <div className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3">
              <label className="block">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#34443a]">
                  <Camera size={16} />
                  Photo
                </span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-2 block w-full text-sm"
                  onChange={(event) =>
                    setPhoto(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-sm font-semibold text-[#34443a]">
                  Caption
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm outline-none transition focus:border-[#17251f]"
                  maxLength={280}
                  onChange={(event) => setCaption(event.target.value)}
                  value={caption}
                />
              </label>
            </div>
          ) : null}

          {postType === "poll" ? (
            <div className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3">
              <label className="block">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#34443a]">
                  <HelpCircle size={16} />
                  Poll question
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm outline-none transition focus:border-[#17251f]"
                  maxLength={240}
                  onChange={(event) => setPollQuestion(event.target.value)}
                  value={pollQuestion}
                />
              </label>
              <div className="mt-3 space-y-2">
                {pollOptions.map((option, index) => (
                  <input
                    className="h-10 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm outline-none transition focus:border-[#17251f]"
                    key={index}
                    maxLength={120}
                    onChange={(event) =>
                      updatePollOption(index, event.target.value)
                    }
                    placeholder={`Option ${index + 1}`}
                    value={option}
                  />
                ))}
              </div>
              <button
                className="mt-3 h-9 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6] disabled:opacity-60"
                disabled={pollOptions.length >= 4}
                onClick={addPollOption}
                type="button"
              >
                Add option
              </button>
            </div>
          ) : null}

          <label className="block">
            <span className="text-sm font-semibold text-[#34443a]">
              Topics or hashtags
            </span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm outline-none transition focus:border-[#17251f]"
              maxLength={180}
              onChange={(event) => setTopics(event.target.value)}
              placeholder="friendship, lagos, #weekendplans"
              value={topics}
            />
          </label>

          <p className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] px-3 py-2 text-sm leading-6 text-[#607265]">
            {helperText}
          </p>

          {error ? (
            <p
              className="rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : (
              <Send size={17} />
            )}
            Publish to Square
          </button>

          <p className="flex items-start gap-2 rounded-md border border-[#e2e6dc] bg-[#fbfaf4] px-3 py-2 text-sm leading-6 text-[#34443a]">
            <Check className="mt-1 shrink-0 text-[#587d62]" size={15} />
            Square is for thoughtful context. Reports, blocks, mutes, and rate
            limits are active from the start.
          </p>
        </form>
      </div>
    </main>
  );
}

function getFailureMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const actionPayload = payload as SquarePostErrorPayload;
  const firstIssue = actionPayload.issues?.[0];
  const issueMessage = firstIssue?.message;
  const issueField = firstIssue?.path?.join(".");
  const issuePrefix = issueField ? `${toFriendlyFieldName(issueField)}: ` : "";

  return (
    [actionPayload.error, issueMessage ? `${issuePrefix}${issueMessage}` : null]
      .filter(Boolean)
      .join(" ") || fallback
  );
}

function toFriendlyFieldName(field: string) {
  const labels: Record<string, string> = {
    body: "Main text",
    caption: "Caption",
    pollOptions: "Poll options",
    pollQuestion: "Poll question",
    postType: "Post type",
    topics: "Topics",
  };

  return labels[field] ?? field;
}
