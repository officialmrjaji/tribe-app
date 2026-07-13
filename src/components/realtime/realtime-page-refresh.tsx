"use client";

import { useRouter } from "next/navigation";
import { useRealtimeInvalidation, type RealtimeInvalidationEvent } from "@/lib/realtime/use-realtime-invalidation";

export function RealtimePageRefresh({
  events,
}: {
  events: RealtimeInvalidationEvent[];
}) {
  const router = useRouter();

  useRealtimeInvalidation({
    events,
    onInvalidate: () => router.refresh(),
  });

  return null;
}
