"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { useState } from "react";

export function AccountActions() {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setError("");
    setIsSigningOut(true);

    try {
      await signOut({ redirectUrl: "/sign-in" });
    } catch {
      setIsSigningOut(false);
      setError("Unable to sign out right now. Please try again.");
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
            <LogOut size={16} />
            Session
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
            Sign out of this device and return to the secure sign-in screen.
          </p>
        </div>
        <button
          className="flex h-10 items-center justify-center rounded-md border border-[#d8ded1] px-4 text-sm font-semibold text-[#17251f] transition hover:border-[#9dad9f] hover:bg-[#fbfaf4] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSigningOut}
          onClick={handleSignOut}
          type="button"
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm font-semibold text-[#8a3325]">{error}</p>
      ) : null}
    </section>
  );
}
