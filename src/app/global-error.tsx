"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body>
        <main style={{ background: "#f6f7f1", minHeight: "100vh", padding: 24 }}>
          <section
            style={{
              background: "white",
              border: "1px solid #d8ded1",
              borderRadius: 8,
              color: "#17201b",
              margin: "48px auto",
              maxWidth: 560,
              padding: 24,
            }}
          >
            <p style={{ color: "#607265", fontSize: 14, fontWeight: 700 }}>
              Something went wrong
            </p>
            <h1 style={{ fontSize: 28, marginTop: 8 }}>
              Tribe needs a quick refresh.
            </h1>
            <p style={{ color: "#34443a", fontSize: 14, lineHeight: 1.6 }}>
              The app hit an unexpected error. Try again, and if it repeats,
              share the error reference with support.
            </p>
            {error.digest ? (
              <p style={{ color: "#607265", fontSize: 12, fontWeight: 700 }}>
                Error reference: {error.digest}
              </p>
            ) : null}
            <button
              onClick={() => unstable_retry()}
              style={{
                background: "#17251f",
                border: 0,
                borderRadius: 6,
                color: "white",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                height: 40,
                marginTop: 16,
                padding: "0 16px",
              }}
              type="button"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
