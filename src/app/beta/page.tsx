import { auth, currentUser } from "@clerk/nextjs/server";
import { ShieldCheck, Users } from "lucide-react";
import { hasBetaAccess } from "@/lib/beta/service";
import {
  ensureOwnedProfile,
  getPrimaryEmail,
  getPrimaryEmailVerified,
} from "@/lib/profile/service";
import { BetaAccessForm } from "./beta-access-form";

export default async function BetaPage() {
  const { isAuthenticated, userId } = await auth();
  let accessGranted = false;
  let nextPath = "/onboarding";

  if (isAuthenticated && userId) {
    const user = await currentUser();

    if (user) {
      const ownedProfile = await ensureOwnedProfile({
        clerkUserId: userId,
        email: getPrimaryEmail(user),
        imageUrl: user.imageUrl,
        isEmailVerified: getPrimaryEmailVerified(user),
        name: user.fullName,
      });

      accessGranted = await hasBetaAccess(ownedProfile.account.id);
      nextPath = ownedProfile.profile.onboarding_completed_at ? "/" : "/onboarding";
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-8 text-[#17201b] sm:px-6 sm:py-12">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <section>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#23624f]">
            <ShieldCheck size={17} />
            Private beta
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">
            A quieter place to find people who fit your pace.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#34443a]">
            TribeApp is currently open to a small group of trusted testers.
            Your thoughtful feedback will help us make discovery, conversations,
            and community feel safer and more useful before a wider launch.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <BetaPrinciple
              body="Browse complete profiles and understand why someone may be a good fit."
              title="Personality first"
            />
            <BetaPrinciple
              body="Private access, mutual-like messaging, and safety controls stay at the center."
              title="Trust by design"
            />
          </div>

          <p className="mt-6 flex items-center gap-2 text-sm text-[#607265]">
            <Users size={16} />
            Limited to 10–20 invited testers for this trial.
          </p>
        </section>

        <BetaAccessForm
          hasAccess={accessGranted}
          isSignedIn={Boolean(isAuthenticated && userId)}
          nextPath={nextPath}
        />
      </div>
    </main>
  );
}

function BetaPrinciple({ body, title }: { body: string; title: string }) {
  return (
    <div className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#607265]">{body}</p>
    </div>
  );
}
