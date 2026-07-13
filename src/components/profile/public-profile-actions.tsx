"use client";

import { Check, Heart, LoaderCircle, X } from "lucide-react";
import { useState } from "react";

type PublicProfileActionsProps = {
  profileId: string;
  profileName: string;
};

type ActionPayload = {
  error?: string;
  issues?: Array<{
    message?: string;
  }>;
  matched?: boolean;
};

export function PublicProfileActions({
  profileId,
  profileName,
}: PublicProfileActionsProps) {
  const [completedAction, setCompletedAction] = useState<"like" | "pass" | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<"like" | "pass" | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitAction(action: "like" | "pass") {
    if (completedAction || pendingAction) {
      return;
    }

    setPendingAction(action);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        action === "like" ? "/api/profile/like" : "/api/profile/pass",
        {
          body: JSON.stringify({ profileId }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | ActionPayload
        | null;

      if (!response.ok) {
        throw new Error(
          getFailureMessage(
            payload,
            action === "like"
              ? "Profile could not be liked."
              : "Profile could not be passed.",
          ),
        );
      }

      setCompletedAction(action);
      setMessage(
        action === "like"
          ? payload?.matched
            ? `You and ${profileName} liked each other. The chat is ready.`
            : `${profileName} was liked and removed from your active People queue.`
          : `${profileName} was passed and removed from your active People queue.`,
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : action === "like"
            ? "Profile could not be liked."
            : "Profile could not be passed.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-[#607265]">Discovery action</p>
      <p className="mt-1 text-sm leading-6 text-[#34443a]">
        Like or pass from here without returning to People. Your queue updates
        quietly in the background.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
          disabled={Boolean(completedAction) || pendingAction === "like"}
          onClick={() => submitAction("like")}
          type="button"
        >
          {pendingAction === "like" ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : completedAction === "like" ? (
            <Check size={17} />
          ) : (
            <Heart size={17} />
          )}
          {completedAction === "like" ? "Liked" : "Like"}
        </button>

        <button
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6] disabled:opacity-60"
          disabled={Boolean(completedAction) || pendingAction === "pass"}
          onClick={() => submitAction("pass")}
          type="button"
        >
          {pendingAction === "pass" ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : completedAction === "pass" ? (
            <Check size={17} />
          ) : (
            <X size={17} />
          )}
          {completedAction === "pass" ? "Passed" : "Pass"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]">
          {error}
        </p>
      ) : null}
      {!error && message ? (
        <p className="mt-3 rounded-md border border-[#94c973] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f36]">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function getFailureMessage(payload: ActionPayload | null, fallback: string) {
  const firstIssue = payload?.issues?.[0]?.message;

  return [payload?.error, firstIssue].filter(Boolean).join(" ") || fallback;
}
