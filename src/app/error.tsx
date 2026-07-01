"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    fetch("/api/monitoring/client-error", {
      body: JSON.stringify({
        digest: error.digest,
        message: error.message,
        name: error.name,
        path: window.location.pathname,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-10 text-[#17201b]">
      <section className="mx-auto max-w-xl rounded-lg border border-[#d8ded1] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#607265]">Something paused</p>
        <h1 className="mt-2 text-2xl font-semibold">
          Tribe could not load this screen.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#34443a]">
          This is usually temporary. You can try again, or return to discovery
          and continue from there.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs font-semibold uppercase text-[#607265]">
            Error reference: {error.digest}
          </p>
        ) : null}
        <button
          className="mt-5 h-10 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
          onClick={() => unstable_retry()}
          type="button"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
