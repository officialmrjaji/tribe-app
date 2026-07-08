import { MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { hasBetaAccess } from "@/lib/beta/service";
import { FeedbackForm } from "./feedback-form";

export default async function FeedbackPage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  if (!(await hasBetaAccess(session.ownedProfile.account.id))) {
    redirect("/beta");
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-[#d8ded1] pb-5">
          <Link
            className="text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
            href="/me"
          >
            Me
          </Link>
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#23624f]">
            <MessageSquareText size={16} />
            Private beta feedback
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Tell us how TribeApp felt.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
            Share bugs, confusing moments, safety concerns, or ideas. Specific
            notes help us improve the next beta build.
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs text-[#607265]">
            <ShieldCheck size={14} />
            Feedback is visible only to the product and moderation team.
          </p>
        </header>

        <div className="mt-6">
          <FeedbackForm />
        </div>
      </div>
    </main>
  );
}
