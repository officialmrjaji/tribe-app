"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

const confirmationText = "REQUEST DELETE";

type RequestState = "idle" | "submitting" | "submitted" | "error";

export function AccountDeletionRequest() {
  const [accepted, setAccepted] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<RequestState>("idle");

  const canSubmit = useMemo(
    () => accepted && confirmation.trim().toUpperCase() === confirmationText,
    [accepted, confirmation],
  );

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
          : "Your account deletion request has been sent to the safety review queue.",
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
        Full deletion is not automatic yet because it must safely remove your
        account, media, payment history, activity, and safety records across all
        our systems. This sends a deletion request for review without
        permanently deleting anything today.
      </p>

      <div className="mt-4 space-y-3 rounded-md border border-[#f0c0b4] bg-[#fff8f5] p-3">
        <label className="flex gap-3 text-sm font-semibold leading-6 text-[#34443a]">
          <input
            checked={accepted}
            className="mt-1 h-4 w-4 rounded border-[#ef8f7a] accent-[#8a3325]"
            onChange={(event) => setAccepted(event.target.checked)}
            type="checkbox"
          />
          <span>I understand this will permanently remove my account.</span>
        </label>

        <label className="block text-sm font-semibold text-[#34443a]">
          Type {confirmationText} to continue
          <input
            className="mt-2 w-full rounded-md border border-[#f0c0b4] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#8a3325] focus:ring-2 focus:ring-[#ef8f7a]/30"
            onChange={(event) => setConfirmation(event.target.value)}
            value={confirmation}
          />
        </label>

        <button
          className="flex h-10 items-center justify-center rounded-md bg-[#8a3325] px-4 text-sm font-semibold text-white transition hover:bg-[#6f271c] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSubmit || state === "submitting" || state === "submitted"}
          onClick={requestDeletion}
          type="button"
        >
          {state === "submitting"
            ? "Requesting..."
            : state === "submitted"
              ? "Request sent"
              : "Request account deletion"}
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
