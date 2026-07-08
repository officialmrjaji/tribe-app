"use client";

import { CheckCircle2, LoaderCircle, MessageSquareText, Star } from "lucide-react";
import { useState } from "react";

const categories = [
  { label: "Something is broken", value: "bug" },
  { label: "Something is confusing", value: "confusing" },
  { label: "I have an idea", value: "idea" },
  { label: "The app feels slow", value: "performance" },
  { label: "Safety or trust concern", value: "safety" },
  { label: "Something else", value: "other" },
] as const;

export function FeedbackForm() {
  const [category, setCategory] = useState<(typeof categories)[number]["value"]>(
    "idea",
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [screenshotOrLink, setScreenshotOrLink] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        body: JSON.stringify({
          category,
          message,
          rating,
          screenshotOrLink,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ??
            "Your feedback could not be submitted. Please try again.",
        );
      }

      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your feedback could not be submitted. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="rounded-lg border border-[#b8d7c9] bg-white p-6 shadow-sm">
        <CheckCircle2 className="text-[#23624f]" size={28} />
        <h2 className="mt-3 text-xl font-semibold">Feedback submitted.</h2>
        <p className="mt-2 text-sm leading-6 text-[#34443a]">
          Thank you for helping shape the private beta. We will review your
          note with the rest of the tester feedback.
        </p>
        <button
          className="mt-5 h-10 rounded-md border border-[#cbd4c6] px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
          onClick={() => {
            setCategory("idea");
            setMessage("");
            setRating(5);
            setScreenshotOrLink("");
            setSubmitted(false);
          }}
          type="button"
        >
          Share more feedback
        </button>
      </section>
    );
  }

  return (
    <form
      className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm sm:p-6"
      onSubmit={submitFeedback}
    >
      <label className="block" htmlFor="feedback-category">
        <span className="text-sm font-semibold text-[#34443a]">Category</span>
        <select
          className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-[#fbfaf4] px-3 text-sm text-[#17201b] outline-none transition focus:border-[#23624f] focus:ring-2 focus:ring-[#94c973]/30"
          id="feedback-category"
          onChange={(event) =>
            setCategory(
              event.target.value as (typeof categories)[number]["value"],
            )
          }
          value={category}
        >
          {categories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="mt-5">
        <legend className="text-sm font-semibold text-[#34443a]">
          Overall experience
        </legend>
        <div className="mt-2 flex gap-2" role="radiogroup">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              aria-label={`${value} out of 5`}
              aria-pressed={rating === value}
              className={`flex h-11 w-11 items-center justify-center rounded-md border transition ${
                rating >= value
                  ? "border-[#23624f] bg-[#e1f0e9] text-[#23624f]"
                  : "border-[#cbd4c6] bg-white text-[#7c8b80] hover:border-[#8fa298]"
              }`}
              key={value}
              onClick={() => setRating(value)}
              type="button"
            >
              <Star fill={rating >= value ? "currentColor" : "none"} size={18} />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block" htmlFor="feedback-message">
        <span className="text-sm font-semibold text-[#34443a]">Your feedback</span>
        <textarea
          className="mt-2 min-h-36 w-full rounded-md border border-[#cbd4c6] bg-[#fbfaf4] px-3 py-3 text-sm leading-6 text-[#17201b] outline-none transition placeholder:text-[#7c8b80] focus:border-[#23624f] focus:ring-2 focus:ring-[#94c973]/30"
          id="feedback-message"
          maxLength={2000}
          minLength={10}
          onChange={(event) => {
            setMessage(event.target.value);
            setError("");
          }}
          placeholder="What happened, what did you expect, or what would make this experience better?"
          required
          value={message}
        />
        <span className="mt-1 block text-right text-xs text-[#607265]">
          {message.length}/2000
        </span>
      </label>

      <label className="mt-4 block" htmlFor="feedback-link">
        <span className="text-sm font-semibold text-[#34443a]">
          Screenshot or page link
        </span>
        <span className="ml-2 text-xs text-[#607265]">Optional</span>
        <input
          className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-[#fbfaf4] px-3 text-sm text-[#17201b] outline-none transition placeholder:text-[#7c8b80] focus:border-[#23624f] focus:ring-2 focus:ring-[#94c973]/30"
          id="feedback-link"
          maxLength={500}
          onChange={(event) => setScreenshotOrLink(event.target.value)}
          placeholder="https://..."
          type="url"
          value={screenshotOrLink}
        />
      </label>

      {error ? (
        <p
          className="mt-4 rounded-md border border-[#ef8f7a] bg-[#fff8f5] px-3 py-2 text-sm font-semibold text-[#8a3325]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#17251f] px-5 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting || message.trim().length < 10}
        type="submit"
      >
        {isSubmitting ? (
          <LoaderCircle className="animate-spin" size={17} />
        ) : (
          <MessageSquareText size={17} />
        )}
        Submit feedback
      </button>
    </form>
  );
}
