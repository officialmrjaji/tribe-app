"use client";

import { CheckCircle2, KeyRound, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type BetaAccessFormProps = {
  hasAccess: boolean;
  isSignedIn: boolean;
  nextPath: string;
};

export function BetaAccessForm({
  hasAccess,
  isSignedIn,
  nextPath,
}: BetaAccessFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function redeemInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/beta/redeem", {
        body: JSON.stringify({ code }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ??
            "The invite code could not be verified. Please try again.",
        );
      }

      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The invite code could not be verified. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  if (hasAccess) {
    return (
      <section className="rounded-lg border border-[#b8d7c9] bg-white p-5 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#23624f]">
          <CheckCircle2 size={17} />
          Beta access confirmed
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[#17201b]">
          You are part of the private beta.
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#34443a]">
          Your access is connected to this account. Continue to TribeApp when
          you are ready.
        </p>
        <Link
          className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-[#17251f] px-5 text-sm font-semibold text-white transition hover:bg-[#253b32]"
          href={nextPath}
        >
          Continue
        </Link>
      </section>
    );
  }

  if (!isSignedIn) {
    return (
      <section className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#607265]">Tester access</p>
        <h2 className="mt-2 text-xl font-semibold text-[#17201b]">
          Sign in before using your invite.
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#34443a]">
          Your invite is linked to your account so it cannot be shared or used
          accidentally by someone else.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md bg-[#17251f] px-5 text-sm font-semibold text-white transition hover:bg-[#253b32]"
            href="/sign-in"
          >
            Sign in
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-[#cbd4c6] px-5 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
            href="/sign-up"
          >
            Create account
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm"
      onSubmit={redeemInvite}
    >
      <label className="block" htmlFor="beta-invite-code">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#34443a]">
          <KeyRound size={16} />
          Invite code
        </span>
        <input
          autoComplete="one-time-code"
          autoFocus
          className="mt-2 h-12 w-full rounded-md border border-[#cbd4c6] bg-[#fbfaf4] px-3 text-base font-semibold uppercase text-[#17201b] outline-none transition placeholder:font-normal placeholder:normal-case placeholder:text-[#7c8b80] focus:border-[#23624f] focus:ring-2 focus:ring-[#94c973]/30"
          id="beta-invite-code"
          maxLength={64}
          onChange={(event) => {
            setCode(event.target.value);
            setError("");
          }}
          placeholder="Enter your private invite"
          required
          value={code}
        />
      </label>

      {error ? (
        <p
          className="mt-3 rounded-md border border-[#ef8f7a] bg-[#fff8f5] px-3 py-2 text-sm font-semibold text-[#8a3325]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#17251f] px-5 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting || code.trim().length < 6}
        type="submit"
      >
        {isSubmitting ? (
          <LoaderCircle className="animate-spin" size={17} />
        ) : (
          <KeyRound size={17} />
        )}
        Verify invite
      </button>
    </form>
  );
}
