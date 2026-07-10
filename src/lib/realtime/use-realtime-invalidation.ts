"use client";

import { useEffect, useRef } from "react";

export type RealtimeInvalidationEvent =
  | "connections"
  | "messages"
  | "notifications"
  | "square";

const realtimeEvents: RealtimeInvalidationEvent[] = [
  "connections",
  "messages",
  "notifications",
  "square",
];
const listeners = new Map<
  RealtimeInvalidationEvent,
  Set<() => void>
>();
let sharedSource: EventSource | null = null;
let subscriberCount = 0;

export function useRealtimeInvalidation({
  events,
  fallbackIntervalMs = 45_000,
  onInvalidate,
}: {
  events: RealtimeInvalidationEvent[];
  fallbackIntervalMs?: number;
  onInvalidate: (event: RealtimeInvalidationEvent | "fallback") => void;
}) {
  const callbackRef = useRef(onInvalidate);
  const eventKey = [...events].sort().join(",");

  useEffect(() => {
    callbackRef.current = onInvalidate;
  }, [onInvalidate]);

  useEffect(() => {
    let fallbackTimer: number | null = null;
    let invalidationTimer: number | null = null;

    const invalidate = (event: RealtimeInvalidationEvent | "fallback") => {
      if (invalidationTimer !== null) {
        window.clearTimeout(invalidationTimer);
      }

      invalidationTimer = window.setTimeout(() => {
        callbackRef.current(event);
      }, 250);
    };

    const selectedEvents = eventKey
      .split(",")
      .filter(Boolean) as RealtimeInvalidationEvent[];
    const unsubscribe = subscribeToSharedEvents(selectedEvents, invalidate);

    fallbackTimer = window.setInterval(
      () => invalidate("fallback"),
      fallbackIntervalMs,
    );

    return () => {
      unsubscribe();

      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer);
      }

      if (invalidationTimer !== null) {
        window.clearTimeout(invalidationTimer);
      }
    };
  }, [eventKey, fallbackIntervalMs]);
}

function subscribeToSharedEvents(
  events: RealtimeInvalidationEvent[],
  listener: (event: RealtimeInvalidationEvent) => void,
) {
  subscriberCount += 1;
  ensureSharedSource();
  const registrations = events.map((event) => {
    const eventListeners = listeners.get(event) ?? new Set<() => void>();
    const registeredListener = () => listener(event);
    eventListeners.add(registeredListener);
    listeners.set(event, eventListeners);

    return { event, registeredListener };
  });

  return () => {
    registrations.forEach(({ event, registeredListener }) => {
      listeners.get(event)?.delete(registeredListener);
    });
    subscriberCount = Math.max(0, subscriberCount - 1);

    if (subscriberCount === 0) {
      sharedSource?.close();
      sharedSource = null;
    }
  };
}

function ensureSharedSource() {
  if (sharedSource || typeof EventSource === "undefined") {
    return;
  }

  sharedSource = new EventSource("/api/realtime/events");
  realtimeEvents.forEach((event) => {
    sharedSource?.addEventListener(event, () => {
      listeners.get(event)?.forEach((listener) => listener());
    });
  });
}
