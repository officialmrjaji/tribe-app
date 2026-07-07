"use client";

import {
  ArrowLeft,
  Flag,
  Heart,
  LoaderCircle,
  MessageCircle,
  Repeat2,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserX,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  SquareFeedResult,
  SquarePost,
  SquareTopic,
  SquareTrendingTopic,
} from "@/lib/square/service";
import { squarePostTypeLabels } from "@/lib/square/schema";

type SquareFeedProps = {
  activeTopicSlug?: string;
  description: string;
  feed: SquareFeedResult;
  title: string;
};

type ApiErrorPayload = {
  error?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function SquareFeed({
  activeTopicSlug,
  description,
  feed,
  title,
}: SquareFeedProps) {
  const [posts, setPosts] = useState(feed.posts);
  const [pendingAction, setPendingAction] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activeTopic = useMemo(
    () => feed.topics.find((topic) => topic.slug === activeTopicSlug) ?? null,
    [activeTopicSlug, feed.topics],
  );

  async function likePost(post: SquarePost) {
    const nextLiked = !post.isLiked;
    const actionId = `like:${post.id}`;

    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/posts/${post.id}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getFailureMessage(payload, "Like could not be saved."));
      }

      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id
            ? {
                ...currentPost,
                isLiked: nextLiked,
                likeCount:
                  typeof payload?.likeCount === "number"
                    ? payload.likeCount
                    : currentPost.likeCount + (nextLiked ? 1 : -1),
              }
            : currentPost,
        ),
      );
    } catch (likeError) {
      setError(
        likeError instanceof Error ? likeError.message : "Like could not save.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function repostPost(post: SquarePost) {
    if (post.isReposted) {
      return;
    }

    const actionId = `repost:${post.id}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/posts/${post.id}/repost`, {
        body: JSON.stringify({ commentary: "" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Square post could not be reposted."),
        );
      }

      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id
            ? {
                ...currentPost,
                isReposted: true,
                repostCount:
                  typeof payload?.repostCount === "number"
                    ? payload.repostCount
                    : currentPost.repostCount + 1,
              }
            : currentPost,
        ),
      );
      setNotice("Reposted quietly to your Square activity.");
    } catch (repostError) {
      setError(
        repostError instanceof Error
          ? repostError.message
          : "Square post could not be reposted.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function votePoll(post: SquarePost, optionId: string) {
    if (!post.poll) {
      return;
    }

    const actionId = `poll:${post.id}:${optionId}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/posts/${post.id}/poll/vote`, {
        body: JSON.stringify({ optionId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Poll vote could not be saved."),
        );
      }

      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id && currentPost.poll
            ? {
                ...currentPost,
                poll: {
                  ...currentPost.poll,
                  options: currentPost.poll.options.map((option) => ({
                    ...option,
                    isSelected: option.id === optionId,
                    voteCount:
                      option.id === optionId && !option.isSelected
                        ? option.voteCount + 1
                        : option.isSelected && option.id !== optionId
                          ? Math.max(0, option.voteCount - 1)
                          : option.voteCount,
                  })),
                  totalVotes: currentPost.poll.options.some(
                    (option) => option.isSelected,
                  )
                    ? currentPost.poll.totalVotes
                    : currentPost.poll.totalVotes + 1,
                },
              }
            : currentPost,
        ),
      );
    } catch (voteError) {
      setError(
        voteError instanceof Error
          ? voteError.message
          : "Poll vote could not be saved.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function reportPost(post: SquarePost) {
    const confirmed = window.confirm("Report this Square post for review?");

    if (!confirmed) {
      return;
    }

    const actionId = `report:${post.id}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/posts/${post.id}/report`, {
        body: JSON.stringify({ reason: "Needs moderation review" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Square post could not be reported."),
        );
      }

      setNotice("Thanks. This post was sent for moderation review.");
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Square post could not be reported.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function muteAuthor(post: SquarePost) {
    if (!post.author.userId) {
      return;
    }

    const confirmed = window.confirm("Hide this member from your Square feed?");

    if (!confirmed) {
      return;
    }

    const actionId = `mute:${post.id}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/square/users/${post.author.userId}/mute`,
        { method: "POST" },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Member could not be hidden."),
        );
      }

      setPosts((currentPosts) =>
        currentPosts.filter(
          (currentPost) => currentPost.author.userId !== post.author.userId,
        ),
      );
      setNotice("That member is hidden from your Square feed.");
    } catch (muteError) {
      setError(
        muteError instanceof Error
          ? muteError.message
          : "Member could not be hidden.",
      );
    } finally {
      setPendingAction("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/"
            >
              <ArrowLeft size={16} />
              People
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Sparkles size={16} />
              Square
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              {description}
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-2 sm:flex">
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/square/trending"
            >
              Trending
            </Link>
            <Link
              className="flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
              href="/square/create"
            >
              Create post
            </Link>
          </nav>
        </header>

        <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            {notice ? (
              <p
                className="mb-4 rounded-md border border-[#94c973] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f36]"
                role="status"
              >
                {notice}
              </p>
            ) : null}
            {error ? (
              <p
                className="mb-4 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            {activeTopic ? (
              <div className="mb-4 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#607265]">
                  Topic view
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  #{activeTopic.slug}
                </h2>
                {activeTopic.description ? (
                  <p className="mt-2 text-sm leading-6 text-[#34443a]">
                    {activeTopic.description}
                  </p>
                ) : null}
              </div>
            ) : null}

            {posts.length === 0 ? (
              <FeedEmptyState />
            ) : (
              <section className="space-y-4">
                {posts.map((post) => (
                  <SquarePostCard
                    key={post.id}
                    onLike={likePost}
                    onMute={muteAuthor}
                    onReport={reportPost}
                    onRepost={repostPost}
                    onVote={votePoll}
                    pendingAction={pendingAction}
                    post={post}
                  />
                ))}
              </section>
            )}
          </div>

          <SquareSidebar
            topics={feed.topics}
            trendingTopics={feed.trendingTopics}
          />
        </section>
      </div>
    </main>
  );
}

function SquarePostCard({
  onLike,
  onMute,
  onReport,
  onRepost,
  onVote,
  pendingAction,
  post,
}: {
  onLike: (post: SquarePost) => void;
  onMute: (post: SquarePost) => void;
  onReport: (post: SquarePost) => void;
  onRepost: (post: SquarePost) => void;
  onVote: (post: SquarePost, optionId: string) => void;
  pendingAction: string;
  post: SquarePost;
}) {
  return (
    <article className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
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
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {post.author.profileHref ? (
                <Link
                  className="font-semibold text-[#17201b] transition hover:text-[#607265]"
                  href={post.author.profileHref}
                >
                  {post.author.name}
                </Link>
              ) : (
                <p className="font-semibold text-[#17201b]">
                  {post.author.name}
                </p>
              )}
              <p className="mt-1 text-xs font-semibold uppercase text-[#607265]">
                {squarePostTypeLabels[post.postType]} / {formatDate(post.createdAt)}
              </p>
            </div>
            <span
              className={cx(
                "rounded-md px-2 py-1 text-xs font-bold",
                post.isAnonymous
                  ? "bg-[#fff4d8] text-[#75520d]"
                  : "bg-[#edf2e9] text-[#2f5f36]",
              )}
            >
              {post.isAnonymous ? "Anonymous" : post.city}
            </span>
          </div>

          {post.author.verification ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#edf2e9] px-2 py-1 text-xs font-semibold text-[#2f5f36]">
              <ShieldCheck size={13} />
              Trusted profile
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {post.body ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#34443a]">
            {post.body}
          </p>
        ) : null}
        {post.caption ? (
          <p className="text-sm leading-6 text-[#607265]">{post.caption}</p>
        ) : null}
        {post.imageUrl ? (
          <Image
            alt={post.caption ?? "Square photo"}
            className="max-h-[460px] w-full rounded-md object-cover"
            height={520}
            src={post.imageUrl}
            width={900}
          />
        ) : null}
      </div>

      {post.poll ? (
        <div className="mt-4 rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3">
          <p className="text-sm font-semibold text-[#34443a]">
            {post.poll.question}
          </p>
          <div className="mt-3 space-y-2">
            {post.poll.options.map((option) => (
              <button
                className={cx(
                  "flex min-h-10 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-sm font-semibold transition disabled:opacity-60",
                  option.isSelected
                    ? "border-[#17251f] bg-[#17251f] text-white"
                    : "border-[#d8ded1] bg-white text-[#34443a] hover:bg-[#f3f0e6]",
                )}
                disabled={pendingAction.startsWith(`poll:${post.id}`)}
                key={option.id}
                onClick={() => onVote(post, option.id)}
                type="button"
              >
                <span>{option.body}</span>
                <span>{option.voteCount}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold uppercase text-[#607265]">
            {post.poll.totalVotes} vote{post.poll.totalVotes === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      {post.topics.length ? (
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
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#e2e6dc] pt-3 sm:grid-cols-5">
        <ActionButton
          active={post.isLiked}
          busy={pendingAction === `like:${post.id}`}
          disabled={pendingAction === `like:${post.id}`}
          icon={Heart}
          label={`${post.likeCount} Like${post.likeCount === 1 ? "" : "s"}`}
          onClick={() => onLike(post)}
        />
        <Link
          className="flex h-10 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
          href={`/square/posts/${post.id}`}
        >
          <MessageCircle size={16} />
          {post.commentCount}
        </Link>
        <ActionButton
          active={post.isReposted}
          busy={pendingAction === `repost:${post.id}`}
          disabled={post.isReposted || pendingAction === `repost:${post.id}`}
          icon={Repeat2}
          label={`${post.repostCount} Repost`}
          onClick={() => onRepost(post)}
        />
        <ActionButton
          busy={pendingAction === `report:${post.id}`}
          disabled={pendingAction === `report:${post.id}` || post.isMine}
          icon={Flag}
          label="Report"
          onClick={() => onReport(post)}
        />
        <ActionButton
          busy={pendingAction === `mute:${post.id}`}
          disabled={
            pendingAction === `mute:${post.id}` ||
            post.isMine ||
            !post.author.userId
          }
          icon={UserX}
          label="Hide"
          onClick={() => onMute(post)}
        />
      </div>
    </article>
  );
}

function SquareSidebar({
  topics,
  trendingTopics,
}: {
  topics: SquareTopic[];
  trendingTopics: SquareTrendingTopic[];
}) {
  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#607265]">
          Trending discussions
        </p>
        <div className="mt-3 space-y-2">
          {trendingTopics.map((topic) => (
            <Link
              className="flex items-center justify-between rounded-md border border-[#e2e6dc] bg-[#fbfaf4] px-3 py-2 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href={`/square/topics/${topic.slug}`}
              key={topic.id}
            >
              <span>#{topic.slug}</span>
              <span>{topic.postCount}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#607265]">Topics</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {topics.slice(0, 14).map((topic) => (
            <Link
              className="rounded-md border border-[#d8ded1] bg-[#fbfaf4] px-2.5 py-1 text-xs font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href={`/square/topics/${topic.slug}`}
              key={topic.id}
            >
              #{topic.slug}
            </Link>
          ))}
        </div>
      </section>
    </aside>
  );
}

function ActionButton({
  active = false,
  busy = false,
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon: typeof Heart;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cx(
        "flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition disabled:opacity-60",
        active
          ? "border-[#17251f] bg-[#17251f] text-white"
          : "border-[#cbd4c6] bg-white text-[#34443a] hover:bg-[#f3f0e6]",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {busy ? (
        <LoaderCircle className="animate-spin" size={16} />
      ) : (
        <Icon size={16} />
      )}
      {label}
    </button>
  );
}

function FeedEmptyState() {
  return (
    <section className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#607265]">Square is quiet</p>
      <h2 className="mt-1 text-xl font-semibold">
        Start a thoughtful community thread.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
        Share a thought, ask a question, recommend a place, or create a small
        poll. Square is designed for social context, not clout.
      </p>
      <Link
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
        href="/square/create"
      >
        Create first post
      </Link>
    </section>
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
