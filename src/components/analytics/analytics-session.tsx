"use client";

import { useEffect } from "react";

const sessionStorageKey = "tribe_session_id";

export function AnalyticsSession() {
  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    const startedAt = Date.now();

    function sendHeartbeat(ended = false) {
      const body = JSON.stringify({
        durationSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
        ended,
        path: window.location.pathname,
        sessionId,
      });

      if (ended && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/analytics/session",
          new Blob([body], { type: "application/json" }),
        );
        return;
      }

      fetch("/api/analytics/session", {
        body,
        headers: {
          "content-type": "application/json",
        },
        keepalive: ended,
        method: "POST",
      }).catch(() => undefined);
    }

    sendHeartbeat(false);
    const interval = window.setInterval(() => sendHeartbeat(false), 60000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendHeartbeat(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sendHeartbeat(true);
    };
  }, []);

  return null;
}

function getOrCreateSessionId() {
  const existing = window.sessionStorage.getItem(sessionStorageKey);

  if (existing) {
    return existing;
  }

  const nextId = `sess_${crypto.randomUUID().replaceAll("-", "")}`;
  window.sessionStorage.setItem(sessionStorageKey, nextId);

  return nextId;
}
