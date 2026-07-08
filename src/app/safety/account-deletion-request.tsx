"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

type RequestState = "idle" | "submitting" | "submitted" | "error";

export function AccountDeletionRequest() {
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<RequestState>("idle");
  const canSubmit = accepted;

  async function requestDeletion() {
    if (!canSubmit || state === "submitting") {
      return;
    }

    setMessage("");
    setState("submitting");

    try {
      const response = await fetch("/api/account/deletion-request", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ confirmed: true }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage =
          payload?.error?.message ??
          payload?.error ??
          "Unable to request account deletion.";

        throw new Error(errorMessage);
      }

      setState("submitted");
      setMessage(
        payload?.alreadyRequested
          ? "Your account deletion request is already in the safety review queue."
          : "Your account deletion request has been sent for safety review. Your account has not been deleted yet.",
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to request account deletion.",
      );
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-[#ef8f7a] bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3325]">
        <Trash2 size={16} />
        Request account deletion
      </p>
      <p className="mt-2 text-sm leading-6 text-[#34443a]">
        Your account and all associated data will be permanently deleted. This
        action cannot be undone.
      </p>

      <div className="mt-4 space-y-3 rounded-md border border-[#f0c0b4] bg-[#fff8f5] p-3">
        <label className="flex gap-3 text-sm font-semibold leading-6 text-[#34443a]">
          <input
            checked={accepted}
            className="mt-1 h-4 w-4 rounded border-[#ef8f7a] accent-[#8a3325]"
            onChange={(event) => setAccepted(event.target.checked)}
            type="checkbox"
          />
          <span>
            I understand that this action will permanently delete my account and
            cannot be undone.
          </span>
        </label>

        <button
          className="flex h-10 items-center justify-center rounded-md bg-[#8a3325] px-4 text-sm font-semibold text-white transition hover:bg-[#6f271c] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSubmit || state === "submitting" || state === "submitted"}
          onClick={requestDeletion}
          type="button"
        >
          {state === "submitting"
            ? "Requesting deletion..."
            : state === "submitted"
              ? "Request sent"
              : "Delete Account"}
        </button>

        {message ? (
          <p
            className={`text-sm font-semibold ${
              state === "error" ? "text-[#8a3325]" : "text-[#34443a]"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
