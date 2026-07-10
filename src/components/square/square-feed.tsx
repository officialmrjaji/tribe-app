"use client";

import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";
import type {
  SquareFeedResult,
  SquareTopic,
  SquareTrendingTopic,
} from "@/lib/square/service";
import { SquarePostCard } from "./square-post-card";

type SquareFeedProps = {
  activeTopicSlug?: string;
  description: string;
  feed: SquareFeedResult;
  title: string;
};

export function SquareFeed({
  activeTopicSlug,
  description,
  feed,
  title,
}: SquareFeedProps) {
  const [posts, setPosts] = useState(feed.posts);
  const activeTopic = useMemo(
    () => feed.topics.find((topic) => topic.slug === activeTopicSlug) ?? null,
    [activeTopicSlug, feed.topics],
  );

  const refreshPosts = useCallback(async () => {
    try {
      const query = activeTopicSlug
        ? `?topic=${encodeURIComponent(activeTopicSlug)}`
        : "";
      const response = await fetch(`/api/square/feed${query}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | SquareFeedResult
        | null;

      if (response.ok && payload) {
        setPosts(payload.posts);
      }
    } catch {
      // Keep the current feed; the interval fallback will retry.
    }
  }, [activeTopicSlug]);

  useRealtimeInvalidation({
    events: ["square"],
    onInvalidate: refreshPosts,
  });

  function removePost(postId: string) {
    setPosts((currentPosts) =>
      currentPosts.filter((post) => post.id !== postId),
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f8f5] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[#c9ddd3] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#477060] transition hover:text-[#17251f]"
              href="/"
            >
              <ArrowLeft size={16} />
              People
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#477060]">
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
              className="flex h-10 items-center justify-center rounded-md border border-[#c9ddd3] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#eef7f1]"
              href="/square/trending"
            >
              Trending
            </Link>
            <Link
              className="flex h-10 items-center justify-center rounded-md bg-[#176b57] px-4 text-sm font-semibold text-white transition hover:bg-[#125744]"
              href="/square/create"
            >
              Create post
            </Link>
          </nav>
        </header>

        <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            {activeTopic ? (
              <div className="mb-3 rounded-lg border border-[#c9ddd3] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#477060]">
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
              <section className="space-y-3">
                {posts.map((post) => (
                  <SquarePostCard
                    key={`${post.id}:${post.editedAt}:${post.likeCount}:${post.commentCount}:${post.repostCount}`}
                    onDeleted={removePost}
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

function SquareSidebar({
  topics,
  trendingTopics,
}: {
  topics: SquareTopic[];
  trendingTopics: SquareTrendingTopic[];
}) {
  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-[#c9ddd3] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#477060]">
          Trending discussions
        </p>
        <div className="mt-3 space-y-2">
          {trendingTopics.map((topic) => (
            <Link
              className="flex items-center justify-between rounded-md border border-[#e0ebe5] bg-[#f8fcf9] px-3 py-2 text-sm font-semibold text-[#34443a] transition hover:bg-[#eef7f1]"
              href={`/square/topics/${topic.slug}`}
              key={topic.id}
            >
              <span>#{topic.slug}</span>
              <span>{topic.postCount}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#c9ddd3] bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#477060]">Topics</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {topics.slice(0, 14).map((topic) => (
            <Link
              className="rounded-md border border-[#c9ddd3] bg-[#f8fcf9] px-2.5 py-1 text-xs font-semibold text-[#34443a] transition hover:bg-[#eef7f1]"
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

function FeedEmptyState() {
  return (
    <section className="rounded-lg border border-[#c9ddd3] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#477060]">Square is quiet</p>
      <h2 className="mt-1 text-xl font-semibold">
        Start a thoughtful community thread.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
        Share a thought, ask a question, recommend a place, or create a small
        poll. Square is designed for social context, not noise.
      </p>
      <Link
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#176b57] px-4 text-sm font-semibold text-white transition hover:bg-[#125744]"
        href="/square/create"
      >
        Create first post
      </Link>
    </section>
  );
}
