"use client";

import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useRealtimeInvalidation } from "@/lib/realtime/use-realtime-invalidation";
import type { SquareComment, SquarePost } from "@/lib/square/service";
import { SquarePostCard } from "./square-post-card";

type SquareThreadProps = {
  comments: SquareComment[];
  post: SquarePost;
};

export function SquareThread({ comments, post }: SquareThreadProps) {
  const [thread, setThread] = useState({ comments, post });
  const refreshThread = useCallback(async () => {
    try {
      const response = await fetch(`/api/square/posts/${post.id}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | SquareThreadProps
        | null;

      if (response.ok && payload) {
        setThread(payload);
      }
    } catch {
      // Keep the current thread; the interval fallback will retry.
    }
  }, [post.id]);

  useRealtimeInvalidation({
    events: ["square"],
    onInvalidate: refreshThread,
  });

  return (
    <main className="min-h-screen bg-[#f3f8f5] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-[#c9ddd3] pb-5">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#477060] transition hover:text-[#17251f]"
            href="/square"
          >
            <ArrowLeft size={16} />
            Square
          </Link>
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#477060]">
            <MessageCircle size={16} />
            Discussion
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Square thread</h1>
        </header>

        <section className="mt-5">
          <SquarePostCard
            expanded
            key={`${thread.post.id}:${thread.post.editedAt}:${thread.post.likeCount}:${thread.post.commentCount}:${thread.post.repostCount}`}
            post={{
              ...thread.post,
              comments: thread.comments,
            }}
          />
        </section>
      </div>
    </main>
  );
}
