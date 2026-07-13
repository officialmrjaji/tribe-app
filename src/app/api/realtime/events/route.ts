import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    return Response.json(
      { error: session.error },
      { status: session.status },
    );
  }

  const userId = session.ownedProfile.account.id;
  const supabase = createSupabaseAdminClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId)
    .is("left_at", null);

  if (membershipError) {
    return Response.json(
      { error: "Realtime conversation access could not be prepared." },
      { status: 500 },
    );
  }

  const conversationIds = new Set(
    (memberships ?? []).map((membership) => String(membership.conversation_id)),
  );
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: RealtimeEventName) => {
        if (closed) {
          return;
        }

        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`,
          ),
        );
      };
      const getRecord = (payload: unknown, key: "new" | "old" = "new") => {
        const record = (payload as Record<string, unknown> | null)?.[key];

        return record && typeof record === "object"
          ? (record as Record<string, unknown>)
          : {};
      };
      const channel = supabase
        .channel(`tribe-user-events:${userId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            filter: `user_id=eq.${userId}`,
            schema: "public",
            table: "conversation_members",
          },
          (payload) => {
            const record = getRecord(payload);
            const conversationId = String(record.conversation_id ?? "");

            if (conversationId) {
              conversationIds.add(conversationId);
              send("messages");
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations" },
          (payload) => {
            const record = getRecord(payload);

            if (conversationIds.has(String(record.id ?? ""))) {
              send("messages");
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const record = getRecord(payload);

            if (conversationIds.has(String(record.conversation_id ?? ""))) {
              send("messages");
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "message_reads" },
          (payload) => {
            const record = getRecord(payload);

            if (conversationIds.has(String(record.conversation_id ?? ""))) {
              send("messages");
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            filter: `recipient_user_id=eq.${userId}`,
            schema: "public",
            table: "notifications",
          },
          () => send("notifications"),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "saved_profiles" },
          (payload) => {
            const next = getRecord(payload);
            const previous = getRecord(payload, "old");
            const relatedUserIds = [
              next.viewer_user_id,
              next.saved_user_id,
              previous.viewer_user_id,
              previous.saved_user_id,
            ].map(String);

            if (relatedUserIds.includes(userId)) {
              send("connections");
            }
          },
        );

      for (const table of [
        "square_comment_likes",
        "square_comments",
        "square_likes",
        "square_posts",
        "square_reposts",
      ]) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => send("square"),
        );
      }

      for (const table of ["voice_room_participants", "voice_rooms"]) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => send("voice"),
        );
      }

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          send("ready");
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          send("degraded");
        }
      });

      const heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, 20_000);

      cleanup = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(heartbeat);
        void supabase.removeChannel(channel);

        try {
          controller.close();
        } catch {
          // The client may already have closed the stream.
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  });
}

type RealtimeEventName =
  | "connections"
  | "degraded"
  | "messages"
  | "notifications"
  | "ready"
  | "square"
  | "voice";
