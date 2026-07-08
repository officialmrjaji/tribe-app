"use client";

import {
  Check,
  Edit3,
  Flag,
  Heart,
  LoaderCircle,
  MessageCircle,
  Repeat2,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { SquareComment, SquarePost } from "@/lib/square/service";
import { squarePostTypeLabels } from "@/lib/square/schema";

type SquarePostCardProps = {
  post: SquarePost;
  expanded?: boolean;
  onDeleted?: (postId: string) => void;
};

type ApiErrorPayload = {
  comment?: SquareComment;
  error?: string;
  likeCount?: number;
  post?: SquarePost;
  repostCount?: number;
};

type CommentNode = SquareComment & {
  replies: CommentNode[];
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function SquarePostCard({
  expanded = false,
  onDeleted,
  post,
}: SquarePostCardProps) {
  const [currentPost, setCurrentPost] = useState(post);
  const [comments, setComments] = useState(post.comments ?? []);
  const [commentDraft, setCommentDraft] = useState("");
  const [editPostBody, setEditPostBody] = useState(post.body);
  const [editPostCaption, setEditPostCaption] = useState(post.caption ?? "");
  const [editingPost, setEditingPost] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [showComposer, setShowComposer] = useState(expanded);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  async function likePost() {
    const nextLiked = !currentPost.isLiked;
    const actionId = `like:${currentPost.id}`;

    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/posts/${currentPost.id}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | null;

      if (!response.ok) {
        throw new Error(getFailureMessage(payload, "Like could not be saved."));
      }

      setCurrentPost((current) => ({
        ...current,
        isLiked: nextLiked,
        likeCount:
          typeof payload?.likeCount === "number"
            ? payload.likeCount
            : Math.max(0, current.likeCount + (nextLiked ? 1 : -1)),
      }));
    } catch (likeError) {
      setError(
        likeError instanceof Error ? likeError.message : "Like could not save.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function repostPost() {
    if (currentPost.isReposted || currentPost.isMine || currentPost.isAnonymous) {
      return;
    }

    const actionId = `repost:${currentPost.id}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/posts/${currentPost.id}/repost`, {
        body: JSON.stringify({ commentary: "" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | null;

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Square post could not be reposted."),
        );
      }

      setCurrentPost((current) => ({
        ...current,
        isReposted: true,
        repostCount:
          typeof payload?.repostCount === "number"
            ? payload.repostCount
            : current.repostCount + 1,
      }));
      setNotice("Reposted to your Square activity.");
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

  async function savePostEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editPostBody.trim() && !editPostCaption.trim() && !currentPost.imageUrl) {
      setError("Square posts need text or media.");
      return;
    }

    setPendingAction(`edit:${currentPost.id}`);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/posts/${currentPost.id}`, {
        body: JSON.stringify({
          body: editPostBody,
          caption: editPostCaption,
          topics: currentPost.topics.map((topic) => topic.slug),
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | null;

      if (!response.ok || !payload?.post) {
        throw new Error(
          getFailureMessage(payload, "Square post could not be edited."),
        );
      }

      const updatedPost = payload.post;
      setCurrentPost((current) => ({
        ...updatedPost,
        comments: current.comments,
      }));
      setEditingPost(false);
      setNotice("Post updated.");
    } catch (editError) {
      setError(
        editError instanceof Error
          ? editError.message
          : "Square post could not be edited.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function deletePost() {
    if (!currentPost.isMine) {
      return;
    }

    const confirmed = window.confirm("Delete this Square post?");

    if (!confirmed) {
      return;
    }

    setPendingAction(`delete:${currentPost.id}`);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/posts/${currentPost.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Square post could not be deleted."),
        );
      }

      onDeleted?.(currentPost.id);
      setNotice("Post deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Square post could not be deleted.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function reportPost() {
    const confirmed = window.confirm("Report this Square post for review?");

    if (!confirmed) {
      return;
    }

    const actionId = `report:${currentPost.id}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/posts/${currentPost.id}/report`, {
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

  async function hideAuthor() {
    if (!currentPost.author.userId) {
      return;
    }

    const confirmed = window.confirm("Hide this member from your Square feed?");

    if (!confirmed) {
      return;
    }

    const actionId = `mute:${currentPost.id}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/square/users/${currentPost.author.userId}/mute`,
        { method: "POST" },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Member could not be hidden."),
        );
      }

      onDeleted?.(currentPost.id);
      setNotice("That member is hidden from your Square feed.");
    } catch (muteError) {
      setError(
        muteError instanceof Error ? muteError.message : "Member could not be hidden.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function votePoll(optionId: string) {
    if (!currentPost.poll) {
      return;
    }

    const actionId = `poll:${currentPost.id}:${optionId}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/square/posts/${currentPost.id}/poll/vote`,
        {
          body: JSON.stringify({ optionId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Poll vote could not be saved."),
        );
      }

      setCurrentPost((current) =>
        current.poll
          ? {
              ...current,
              poll: {
                ...current.poll,
                options: current.poll.options.map((option) => ({
                  ...option,
                  isSelected: option.id === optionId,
                  voteCount:
                    option.id === optionId && !option.isSelected
                      ? option.voteCount + 1
                      : option.isSelected && option.id !== optionId
                        ? Math.max(0, option.voteCount - 1)
                        : option.voteCount,
                })),
                totalVotes: current.poll.options.some(
                  (option) => option.isSelected,
                )
                  ? current.poll.totalVotes
                  : current.poll.totalVotes + 1,
              },
            }
          : current,
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

  async function submitComment(parentCommentId?: string) {
    const draft = parentCommentId
      ? replyDrafts[parentCommentId]?.trim()
      : commentDraft.trim();

    if (!draft) {
      return;
    }

    const actionId = parentCommentId
      ? `reply:${parentCommentId}`
      : `comment:${currentPost.id}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/posts/${currentPost.id}/comments`, {
        body: JSON.stringify({ body: draft, parentCommentId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | null;

      if (!response.ok || !payload?.comment) {
        throw new Error(
          getFailureMessage(payload, "Comment could not be posted."),
        );
      }

      setComments((currentComments) => [...currentComments, payload.comment!]);
      setCurrentPost((current) => ({
        ...current,
        commentCount: current.commentCount + 1,
      }));
      setCommentDraft("");
      setReplyDrafts((currentDrafts) => ({
        ...currentDrafts,
        ...(parentCommentId ? { [parentCommentId]: "" } : {}),
      }));
      setReplyingToCommentId("");
      setShowComposer(false);
      setNotice(parentCommentId ? "Reply posted." : "Comment posted.");
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

  async function likeComment(comment: SquareComment) {
    const nextLiked = !comment.isLiked;
    const actionId = `comment-like:${comment.id}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/comments/${comment.id}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | null;

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Comment like could not be saved."),
        );
      }

      updateComment(comment.id, (current) => ({
        ...current,
        isLiked: nextLiked,
        likeCount:
          typeof payload?.likeCount === "number"
            ? payload.likeCount
            : Math.max(0, current.likeCount + (nextLiked ? 1 : -1)),
      }));
    } catch (likeError) {
      setError(
        likeError instanceof Error
          ? likeError.message
          : "Comment like could not be saved.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function saveCommentEdit(comment: SquareComment) {
    if (!editingCommentBody.trim()) {
      setError("Comment cannot be empty.");
      return;
    }

    const actionId = `comment-edit:${comment.id}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/comments/${comment.id}`, {
        body: JSON.stringify({ body: editingCommentBody }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json().catch(() => null)) as
        | ApiErrorPayload
        | null;

      if (!response.ok || !payload?.comment) {
        throw new Error(
          getFailureMessage(payload, "Comment could not be edited."),
        );
      }

      updateComment(comment.id, () => payload.comment!);
      setEditingCommentId("");
      setEditingCommentBody("");
      setNotice("Comment updated.");
    } catch (editError) {
      setError(
        editError instanceof Error
          ? editError.message
          : "Comment could not be edited.",
      );
    } finally {
      setPendingAction("");
    }
  }

  async function deleteComment(comment: SquareComment) {
    const confirmed = window.confirm("Delete this comment?");

    if (!confirmed) {
      return;
    }

    const actionId = `comment-delete:${comment.id}`;
    setPendingAction(actionId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/square/comments/${comment.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getFailureMessage(payload, "Comment could not be deleted."),
        );
      }

      const descendantIds = getDescendantCommentIds(comments, comment.id);
      setComments((currentComments) =>
        currentComments.filter(
          (currentComment) =>
            currentComment.id !== comment.id &&
            !descendantIds.has(currentComment.id),
        ),
      );
      setCurrentPost((current) => ({
        ...current,
        commentCount: Math.max(0, current.commentCount - 1 - descendantIds.size),
      }));
      setNotice("Comment deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Comment could not be deleted.",
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

    const actionId = `comment-report:${comment.id}`;
    setPendingAction(actionId);
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

  function updateComment(
    commentId: string,
    updater: (comment: SquareComment) => SquareComment,
  ) {
    setComments((currentComments) =>
      currentComments.map((comment) =>
        comment.id === commentId ? updater(comment) : comment,
      ),
    );
  }

  return (
    <article className="overflow-hidden rounded-lg border border-[#c9ddd3] bg-white shadow-sm transition duration-200 hover:border-[#9cc7b7]">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {currentPost.author.avatarUrl ? (
            <Image
              alt={`${currentPost.author.name} avatar`}
              className="h-11 w-11 rounded-md object-cover"
              height={44}
              src={currentPost.author.avatarUrl}
              width={44}
            />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#176b57] text-white">
              <UserRound size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                {currentPost.author.profileHref ? (
                  <Link
                    className="font-semibold text-[#17201b] transition hover:text-[#477060]"
                    href={currentPost.author.profileHref}
                  >
                    {currentPost.author.name}
                  </Link>
                ) : (
                  <p className="font-semibold text-[#17201b]">
                    {currentPost.author.name}
                  </p>
                )}
                <p className="mt-1 text-xs font-semibold uppercase text-[#477060]">
                  {squarePostTypeLabels[currentPost.postType]} /{" "}
                  {formatDate(currentPost.createdAt)}
                  {currentPost.editedAt ? " / Edited" : ""}
                </p>
              </div>
              <span
                className={cx(
                  "rounded-md px-2 py-1 text-xs font-bold",
                  currentPost.isAnonymous
                    ? "bg-[#fff4d8] text-[#75520d]"
                    : "bg-[#e4f4ec] text-[#176b57]",
                )}
              >
                {currentPost.isAnonymous ? "Anonymous" : currentPost.city}
              </span>
            </div>

            {currentPost.author.verification ? (
              <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#e4f4ec] px-2 py-1 text-xs font-semibold text-[#176b57]">
                <ShieldCheck size={13} />
                Trusted profile
              </p>
            ) : null}
          </div>
        </div>

        {editingPost ? (
          <form className="mt-4 space-y-3" onSubmit={savePostEdit}>
            <textarea
              className="min-h-28 w-full rounded-md border border-[#c9ddd3] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#176b57] focus:ring-2 focus:ring-[#176b57]/15"
              maxLength={1400}
              onChange={(event) => setEditPostBody(event.target.value)}
              value={editPostBody}
            />
            <input
              className="w-full rounded-md border border-[#c9ddd3] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#176b57] focus:ring-2 focus:ring-[#176b57]/15"
              maxLength={280}
              onChange={(event) => setEditPostCaption(event.target.value)}
              placeholder="Caption"
              value={editPostCaption}
            />
            <div className="flex flex-wrap gap-2">
              <button
                className="flex h-9 items-center justify-center gap-2 rounded-md bg-[#176b57] px-3 text-sm font-semibold text-white transition hover:bg-[#125744] disabled:opacity-60"
                disabled={pendingAction === `edit:${currentPost.id}`}
                type="submit"
              >
                {pendingAction === `edit:${currentPost.id}` ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : (
                  <Check size={15} />
                )}
                Save changes
              </button>
              <button
                className="flex h-9 items-center justify-center gap-2 rounded-md border border-[#c9ddd3] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#eef7f1]"
                onClick={() => setEditingPost(false)}
                type="button"
              >
                <X size={15} />
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-3">
            {currentPost.body ? (
              <RichText text={currentPost.body} />
            ) : null}
            {currentPost.caption ? (
              <p className="text-sm leading-6 text-[#477060]">
                <RichInlineText text={currentPost.caption} />
              </p>
            ) : null}
            {currentPost.imageUrl ? (
              <Image
                alt={currentPost.caption ?? "Square photo"}
                className="max-h-[460px] w-full rounded-md object-cover transition duration-200 hover:scale-[1.005]"
                height={520}
                src={currentPost.imageUrl}
                width={900}
              />
            ) : null}
          </div>
        )}

        {currentPost.poll ? (
          <div className="mt-4 rounded-md border border-[#dcebe4] bg-[#f8fcf9] p-3">
            <p className="text-sm font-semibold text-[#34443a]">
              {currentPost.poll.question}
            </p>
            <div className="mt-3 space-y-2">
              {currentPost.poll.options.map((option) => (
                <button
                  className={cx(
                    "flex min-h-10 w-full items-center justify-between gap-3 rounded-md border px-3 text-left text-sm font-semibold transition disabled:opacity-60",
                    option.isSelected
                      ? "border-[#176b57] bg-[#176b57] text-white"
                      : "border-[#c9ddd3] bg-white text-[#34443a] hover:bg-[#eef7f1]",
                  )}
                  disabled={pendingAction.startsWith(`poll:${currentPost.id}`)}
                  key={option.id}
                  onClick={() => votePoll(option.id)}
                  type="button"
                >
                  <span>{option.body}</span>
                  <span>{option.voteCount}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold uppercase text-[#477060]">
              {currentPost.poll.totalVotes} vote
              {currentPost.poll.totalVotes === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}

        {currentPost.topics.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {currentPost.topics.map((topic) => (
              <Link
                className="rounded-md bg-[#f3f8f5] px-2.5 py-1 text-xs font-semibold text-[#34443a] transition hover:bg-[#e4f4ec]"
                href={`/square/topics/${topic.slug}`}
                key={topic.id}
              >
                #{topic.slug}
              </Link>
            ))}
          </div>
        ) : null}

        {notice ? <Notice message={notice} tone="success" /> : null}
        {error ? <Notice message={error} tone="error" /> : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#dcebe4] pt-3">
          <ActionButton
            active={currentPost.isLiked}
            busy={pendingAction === `like:${currentPost.id}`}
            icon={Heart}
            label={`${currentPost.likeCount} Like${
              currentPost.likeCount === 1 ? "" : "s"
            }`}
            onClick={likePost}
          />
          <ActionButton
            active={showComposer}
            icon={MessageCircle}
            label={`${currentPost.commentCount} Comment${
              currentPost.commentCount === 1 ? "" : "s"
            }`}
            onClick={() => setShowComposer((value) => !value)}
          />
          <ActionButton
            active={currentPost.isReposted}
            busy={pendingAction === `repost:${currentPost.id}`}
            disabled={
              currentPost.isReposted ||
              currentPost.isMine ||
              currentPost.isAnonymous
            }
            icon={Repeat2}
            label={`${currentPost.repostCount} Repost`}
            onClick={repostPost}
          />
          {currentPost.isMine ? (
            <>
              <ActionButton
                active={editingPost}
                icon={Edit3}
                label="Edit"
                onClick={() => setEditingPost(true)}
              />
              <ActionButton
                busy={pendingAction === `delete:${currentPost.id}`}
                icon={Trash2}
                label="Delete"
                onClick={deletePost}
                tone="danger"
              />
            </>
          ) : (
            <>
              <ActionButton
                busy={pendingAction === `report:${currentPost.id}`}
                icon={Flag}
                label="Report"
                onClick={reportPost}
              />
              <ActionButton
                busy={pendingAction === `mute:${currentPost.id}`}
                disabled={!currentPost.author.userId}
                icon={UserX}
                label="Hide"
                onClick={hideAuthor}
              />
            </>
          )}
        </div>
      </div>

      {(showComposer || comments.length > 0) ? (
        <section className="border-t border-[#dcebe4] bg-[#f8fcf9] px-4 py-3">
          {showComposer ? (
            <form
              className="mb-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void submitComment();
              }}
            >
              <label className="sr-only" htmlFor={`comment-${currentPost.id}`}>
                Add a comment
              </label>
              <textarea
                className="min-h-12 flex-1 resize-none rounded-md border border-[#c9ddd3] bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-[#176b57] focus:ring-2 focus:ring-[#176b57]/15"
                id={`comment-${currentPost.id}`}
                maxLength={1000}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Add a thoughtful comment. Use @name to mention someone."
                value={commentDraft}
              />
              <button
                className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#176b57] px-4 text-sm font-semibold text-white transition hover:bg-[#125744] disabled:opacity-60"
                disabled={
                  pendingAction === `comment:${currentPost.id}` ||
                  !commentDraft.trim()
                }
                type="submit"
              >
                {pendingAction === `comment:${currentPost.id}` ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Send size={16} />
                )}
                Comment
              </button>
            </form>
          ) : null}

          {comments.length === 0 ? (
            <p className="rounded-md border border-[#dcebe4] bg-white px-3 py-2 text-sm text-[#477060]">
              No comments yet. Start with a useful reply or a clarifying
              question.
            </p>
          ) : (
            <div className="space-y-2">
              {commentTree.map((comment) => (
                <CommentItem
                  comment={comment}
                  deleteComment={deleteComment}
                  editingCommentBody={editingCommentBody}
                  editingCommentId={editingCommentId}
                  likeComment={likeComment}
                  pendingAction={pendingAction}
                  reportComment={reportComment}
                  replyingToCommentId={replyingToCommentId}
                  replyDrafts={replyDrafts}
                  saveCommentEdit={saveCommentEdit}
                  setEditingCommentBody={setEditingCommentBody}
                  setEditingCommentId={setEditingCommentId}
                  setReplyDrafts={setReplyDrafts}
                  setReplyingToCommentId={setReplyingToCommentId}
                  submitComment={submitComment}
                  key={comment.id}
                />
              ))}
            </div>
          )}

          {currentPost.commentCount > comments.length ? (
            <Link
              className="mt-3 inline-flex text-sm font-semibold text-[#176b57] transition hover:text-[#125744]"
              href={`/square/posts/${currentPost.id}`}
            >
              View full discussion
            </Link>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

function CommentItem({
  comment,
  deleteComment,
  depth = 0,
  editingCommentBody,
  editingCommentId,
  likeComment,
  pendingAction,
  reportComment,
  replyingToCommentId,
  replyDrafts,
  saveCommentEdit,
  setEditingCommentBody,
  setEditingCommentId,
  setReplyDrafts,
  setReplyingToCommentId,
  submitComment,
}: {
  comment: CommentNode;
  deleteComment: (comment: SquareComment) => void;
  depth?: number;
  editingCommentBody: string;
  editingCommentId: string;
  likeComment: (comment: SquareComment) => void;
  pendingAction: string;
  reportComment: (comment: SquareComment) => void;
  replyingToCommentId: string;
  replyDrafts: Record<string, string>;
  saveCommentEdit: (comment: SquareComment) => void;
  setEditingCommentBody: (body: string) => void;
  setEditingCommentId: (id: string) => void;
  setReplyDrafts: (
    update: (currentDrafts: Record<string, string>) => Record<string, string>,
  ) => void;
  setReplyingToCommentId: (id: string) => void;
  submitComment: (parentCommentId?: string) => void;
}) {
  const isEditing = editingCommentId === comment.id;
  const isReplying = replyingToCommentId === comment.id;

  return (
    <div
      className={cx(
        "rounded-md bg-white px-3 py-3 shadow-sm",
        depth > 0 && "border-l-2 border-[#9cc7b7]",
      )}
      style={{ marginLeft: depth > 0 ? Math.min(depth, 2) * 14 : 0 }}
    >
      <div className="flex items-start gap-3">
        {comment.author.avatarUrl ? (
          <Image
            alt={`${comment.author.name} avatar`}
            className="h-8 w-8 rounded-md object-cover"
            height={32}
            src={comment.author.avatarUrl}
            width={32}
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#176b57] text-white">
            <UserRound size={14} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {comment.author.profileHref ? (
              <Link
                className="text-sm font-semibold text-[#17201b] transition hover:text-[#477060]"
                href={comment.author.profileHref}
              >
                {comment.author.name}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-[#17201b]">
                {comment.author.name}
              </p>
            )}
            <span className="text-xs font-semibold uppercase text-[#477060]">
              {formatDate(comment.createdAt)}
              {comment.editedAt ? " / Edited" : ""}
            </span>
          </div>

          {isEditing ? (
            <form
              className="mt-2 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void saveCommentEdit(comment);
              }}
            >
              <textarea
                className="min-h-20 w-full rounded-md border border-[#c9ddd3] bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-[#176b57] focus:ring-2 focus:ring-[#176b57]/15"
                maxLength={1000}
                onChange={(event) => setEditingCommentBody(event.target.value)}
                value={editingCommentBody}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#176b57] px-3 text-xs font-semibold text-white transition hover:bg-[#125744] disabled:opacity-60"
                  disabled={pendingAction === `comment-edit:${comment.id}`}
                  type="submit"
                >
                  {pendingAction === `comment-edit:${comment.id}` ? (
                    <LoaderCircle className="animate-spin" size={14} />
                  ) : (
                    <Check size={14} />
                  )}
                  Save
                </button>
                <button
                  className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#c9ddd3] bg-white px-3 text-xs font-semibold text-[#34443a] transition hover:bg-[#eef7f1]"
                  onClick={() => setEditingCommentId("")}
                  type="button"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#34443a]">
              <RichInlineText text={comment.body} />
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <MiniActionButton
              active={comment.isLiked}
              busy={pendingAction === `comment-like:${comment.id}`}
              icon={Heart}
              label={`${comment.likeCount} Like${
                comment.likeCount === 1 ? "" : "s"
              }`}
              onClick={() => likeComment(comment)}
            />
            <MiniActionButton
              active={isReplying}
              icon={MessageCircle}
              label="Reply"
              onClick={() =>
                setReplyingToCommentId(isReplying ? "" : comment.id)
              }
            />
            {comment.isMine ? (
              <>
                <MiniActionButton
                  active={isEditing}
                  icon={Edit3}
                  label="Edit"
                  onClick={() => {
                    setEditingCommentId(comment.id);
                    setEditingCommentBody(comment.body);
                  }}
                />
                <MiniActionButton
                  busy={pendingAction === `comment-delete:${comment.id}`}
                  icon={Trash2}
                  label="Delete"
                  onClick={() => deleteComment(comment)}
                  tone="danger"
                />
              </>
            ) : (
              <MiniActionButton
                busy={pendingAction === `comment-report:${comment.id}`}
                icon={Flag}
                label="Report"
                onClick={() => reportComment(comment)}
              />
            )}
          </div>

          {isReplying ? (
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void submitComment(comment.id);
              }}
            >
              <textarea
                className="min-h-10 flex-1 resize-none rounded-md border border-[#c9ddd3] bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-[#176b57] focus:ring-2 focus:ring-[#176b57]/15"
                maxLength={1000}
                onChange={(event) =>
                  setReplyDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [comment.id]: event.target.value,
                  }))
                }
                placeholder="Reply thoughtfully. Use @name to mention someone."
                value={replyDrafts[comment.id] ?? ""}
              />
              <button
                className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#176b57] px-3 text-sm font-semibold text-white transition hover:bg-[#125744] disabled:opacity-60"
                disabled={
                  pendingAction === `reply:${comment.id}` ||
                  !replyDrafts[comment.id]?.trim()
                }
                type="submit"
              >
                {pendingAction === `reply:${comment.id}` ? (
                  <LoaderCircle className="animate-spin" size={15} />
                ) : (
                  <Send size={15} />
                )}
                Reply
              </button>
            </form>
          ) : null}

          {comment.replies.length ? (
            <div className="mt-2 space-y-2">
              {comment.replies.map((reply) => (
                <CommentItem
                  comment={reply}
                  deleteComment={deleteComment}
                  depth={depth + 1}
                  editingCommentBody={editingCommentBody}
                  editingCommentId={editingCommentId}
                  likeComment={likeComment}
                  pendingAction={pendingAction}
                  reportComment={reportComment}
                  replyingToCommentId={replyingToCommentId}
                  replyDrafts={replyDrafts}
                  saveCommentEdit={saveCommentEdit}
                  setEditingCommentBody={setEditingCommentBody}
                  setEditingCommentId={setEditingCommentId}
                  setReplyDrafts={setReplyDrafts}
                  setReplyingToCommentId={setReplyingToCommentId}
                  submitComment={submitComment}
                  key={reply.id}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  active = false,
  busy = false,
  disabled = false,
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  active?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "danger" | "default";
}) {
  return (
    <button
      className={cx(
        "flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "border-[#176b57] bg-[#176b57] text-white"
          : tone === "danger"
            ? "border-[#ef8f7a] bg-white text-[#8a3325] hover:bg-[#fff5f1]"
            : "border-[#c9ddd3] bg-white text-[#34443a] hover:bg-[#eef7f1]",
      )}
      disabled={disabled || busy}
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

function MiniActionButton({
  active = false,
  busy = false,
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  active?: boolean;
  busy?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "danger" | "default";
}) {
  return (
    <button
      className={cx(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition disabled:opacity-60",
        active
          ? "bg-[#176b57] text-white"
          : tone === "danger"
            ? "text-[#8a3325] hover:bg-[#fff5f1]"
            : "text-[#477060] hover:bg-[#eef7f1]",
      )}
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      {busy ? (
        <LoaderCircle className="animate-spin" size={13} />
      ) : (
        <Icon size={13} />
      )}
      {label}
    </button>
  );
}

function Notice({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success";
}) {
  return (
    <p
      className={cx(
        "mt-4 rounded-md border bg-white px-3 py-2 text-sm font-semibold",
        tone === "error"
          ? "border-[#ef8f7a] text-[#8a3325]"
          : "border-[#94c973] text-[#2f5f36]",
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap text-sm leading-6 text-[#34443a]">
      <RichInlineText text={text} />
    </p>
  );
}

function RichInlineText({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);

  return (
    <>
      {parts.map((part, index) => {
        if (/^#[a-zA-Z0-9_-]{2,48}$/.test(part)) {
          const slug = part.slice(1).toLowerCase();

          return (
            <Link
              className="font-semibold text-[#176b57] hover:text-[#125744]"
              href={`/square/topics/${slug}`}
              key={`${part}-${index}`}
            >
              {part}
            </Link>
          );
        }

        if (/^@[a-zA-Z0-9_-]{2,64}$/.test(part)) {
          return (
            <span
              className="font-semibold text-[#176b57]"
              key={`${part}-${index}`}
            >
              {part}
            </span>
          );
        }

        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

function buildCommentTree(comments: SquareComment[]) {
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((comment) => {
    nodes.set(comment.id, { ...comment, replies: [] });
  });

  nodes.forEach((node) => {
    if (node.parentCommentId && nodes.has(node.parentCommentId)) {
      nodes.get(node.parentCommentId)?.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function getDescendantCommentIds(comments: SquareComment[], commentId: string) {
  const ids = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    comments.forEach((comment) => {
      if (
        comment.parentCommentId &&
        (comment.parentCommentId === commentId || ids.has(comment.parentCommentId)) &&
        !ids.has(comment.id)
      ) {
        ids.add(comment.id);
        changed = true;
      }
    });
  }

  return ids;
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
