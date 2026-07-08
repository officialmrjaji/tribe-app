"use client";

import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import type { SquareComment, SquarePost } from "@/lib/square/service";
import { SquarePostCard } from "./square-post-card";

type SquareThreadProps = {
  comments: SquareComment[];
  post: SquarePost;
};

export function SquareThread({ comments, post }: SquareThreadProps) {
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
            post={{
              ...post,
              comments,
            }}
          />
        </section>
      </div>
    </main>
  );
}
