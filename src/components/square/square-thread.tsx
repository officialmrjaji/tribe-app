"use client";

import {
  ArrowLeft,
  Flag,
  LoaderCircle,
  MessageCircle,
  Send,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import type { SquareComment, SquarePost } from "@/lib/square/service";
import { squarePostTypeLabels } from "@/lib/square/schema";

type SquareThreadProps = {
  comments: SquareComment[];
  post: SquarePost;
};

type ApiErrorPayload = {
  error?: string;
};

export function SquareThread({
  comments: initialComments,
  post,
}: SquareThreadProps) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!body.trim()) {
      return;
    }

    setPendingAction("comment");
    setNotice("");
    setError("");

    try {
      const response = await fetch(`/api/square/posts/${post.id}/comments`, {
        body: JSON.stringify({ body }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Comment could not be posted."),
        );
      }

      setComments((currentComments) => [
        ...currentComments,
        payload.comment as SquareComment,
      ]);
      setBody("");
      setNotice("Comment posted.");
    } catch (commentError) {
      setError(
        commentError instanceof Error
          ? commentError.message
          : "Comment could not be posted.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function reportComment(comment: SquareComment) {
    const confirmed = window.confirm("Report this comment for review?");

    if (!confirmed) {
      return;
    }

    setPendingAction(`report:${comment.id}`);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/comments/${comment.id}/report`, {
        body: JSON.stringify({ reason: "Needs moderation review" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Comment could not be reported."),
        );
      }

      setNotice("Thanks. This comment was sent for moderation review.");
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Comment could not be reported.",
      );
    } finally {
      setPendingAction("");
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
            <MessageCircle size={16} />
            Discussion
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Square thread</h1>
        </header>

        <article className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            {post.author.avatarUrl ? (
              <Image
                alt={`${post.author.name} avatar`}
                className="h-11 w-11 rounded-md object-cover"
                height={44}
                src={post.author.avatarUrl}
                width={44}
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#17251f] text-white">
                <UserRound size={18} />
              </span>
            )}
            <div>
              {post.author.profileHref ? (
                <Link
                  className="font-semibold text-[#17201b] transition hover:text-[#607265]"
                  href={post.author.profileHref}
                >
                  {post.author.name}
                </Link>
              ) : (
                <p className="font-semibold">{post.author.name}</p>
              )}
              <p className="mt-1 text-xs font-semibold uppercase text-[#607265]">
                {squarePostTypeLabels[post.postType]} / {formatDate(post.createdAt)}
              </p>
            </div>
          </div>

          {post.body ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#34443a]">
              {post.body}
            </p>
          ) : null}
          {post.imageUrl ? (
            <Image
              alt={post.caption ?? "Square photo"}
              className="mt-4 max-h-[520px] w-full rounded-md object-cover"
              height={520}
              src={post.imageUrl}
              width={900}
            />
          ) : null}
          {post.caption ? (
            <p className="mt-3 text-sm leading-6 text-[#607265]">
              {post.caption}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {post.topics.map((topic) => (
              <Link
                className="rounded-md bg-[#f6f7f1] px-2.5 py-1 text-xs font-semibold text-[#34443a] transition hover:bg-[#e2e6dc]"
                href={`/square/topics/${topic.slug}`}
                key={topic.id}
              >
                #{topic.slug}
              </Link>
            ))}
          </div>
        </article>

        {notice ? (
          <p
            className="mt-4 rounded-md border border-[#94c973] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f36]"
            role="status"
          >
            {notice}
          </p>
        ) : null}
        {error ? (
          <p
            className="mt-4 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form
          className="mt-5 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm"
          onSubmit={submitComment}
        >
          <label className="block">
            <span className="text-sm font-semibold text-[#34443a]">
              Add a comment
            </span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-[#cbd4c6] bg-white px-3 py-3 text-sm leading-6 text-[#17201b] outline-none transition focus:border-[#17251f]"
              maxLength={1000}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Keep it thoughtful and useful."
              value={body}
            />
          </label>
          <button
            className="mt-3 flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
            disabled={pendingAction === "comment" || !body.trim()}
            type="submit"
          >
            {pendingAction === "comment" ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <Send size={16} />
            )}
            Post comment
          </button>
        </form>

        <section className="mt-5 space-y-3">
          {comments.length === 0 ? (
            <div className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[#607265]">
                No comments yet
              </p>
              <p className="mt-2 text-sm leading-6 text-[#34443a]">
                Start with a grounded reply, a useful recommendation, or a
                clarifying question.
              </p>
            </div>
          ) : null}

          {comments.map((comment) => (
            <article
              className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm"
              key={comment.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  {comment.author.profileHref ? (
                    <Link
                      className="font-semibold text-[#17201b] transition hover:text-[#607265]"
                      href={comment.author.profileHref}
                    >
                      {comment.author.name}
                    </Link>
                  ) : (
                    <p className="font-semibold">{comment.author.name}</p>
                  )}
                  <p className="mt-1 text-xs font-semibold uppercase text-[#607265]">
                    {formatDate(comment.createdAt)}
                  </p>
                </div>
                {!comment.isMine ? (
                  <button
                    className="flex h-9 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6] disabled:opacity-60"
                    disabled={pendingAction === `report:${comment.id}`}
                    onClick={() => reportComment(comment)}
                    type="button"
                  >
                    {pendingAction === `report:${comment.id}` ? (
                      <LoaderCircle className="animate-spin" size={15} />
                    ) : (
                      <Flag size={15} />
                    )}
                    Report
                  </button>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#34443a]">
                {comment.body}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function getFailureMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  return (payload as ApiErrorPayload).error ?? fallback;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}
