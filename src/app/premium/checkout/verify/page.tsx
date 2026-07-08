import { ArrowLeft, CheckCircle2, Crown, XCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { isFeatureEnabled } from "@/lib/feature-flags";

type VerifyPageProps = {
  searchParams: Promise<{
    reference?: string | string[];
  }>;
};

export default async function PremiumCheckoutVerifyPage({
  searchParams,
}: VerifyPageProps) {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const reference = Array.isArray(params.reference)
    ? params.reference[0]
    : params.reference;
  let state: {
    message: string;
    title: string;
    tone: "error" | "success";
  } = {
    message:
      "Premium memberships are almost here. Checkout verification is paused for private beta.",
    title: "Tribe Plus is coming soon",
    tone: "success",
  };

  if (!isFeatureEnabled("premium") || !isFeatureEnabled("payments")) {
    state = {
      message:
        "Premium memberships are almost here. Checkout verification is paused for private beta.",
      title: "Tribe Plus is coming soon",
      tone: "success",
    };
  } else if (!reference) {
    state = {
      message: "The payment provider did not return a payment reference.",
      title: "Payment reference missing",
      tone: "error",
    };
  } else {
    try {
      const { verifyPremiumPurchaseForUser } = await import(
        "@/lib/premium/service"
      );
      const result = await verifyPremiumPurchaseForUser({
        ownedProfile: session.ownedProfile,
        reference,
      });

      state = {
        message:
          result.plan.productType === "premium"
            ? "Your Tribe Plus access is active."
            : "Your profile boost is active.",
        title: "Payment verified",
        tone: "success",
      };
    } catch (error) {
      state = {
        message:
          error instanceof Error
            ? error.message
            : "The payment could not be verified yet.",
        title: "Verification needs attention",
        tone: "error",
      };
    }
  }

  const Icon = state.tone === "success" ? CheckCircle2 : XCircle;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f1] px-4 py-8 text-[#17201b]">
      <section className="w-full max-w-lg rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
          href="/premium"
        >
          <ArrowLeft size={16} />
          Premium
        </Link>
        <div className="mt-5 flex items-start gap-3">
          <span
            className={
              state.tone === "success"
                ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#edf2e9] text-[#2f5f36]"
                : "flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#fff4ef] text-[#8a3325]"
            }
          >
            <Icon size={22} />
          </span>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Crown size={16} />
              Tribe Premium
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{state.title}</h1>
            <p className="mt-2 text-sm leading-6 text-[#34443a]">
              {state.message}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link
            className="flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
            href="/premium/manage"
          >
            View status
          </Link>
          <Link
            className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
            href="/"
          >
            Back to discovery
          </Link>
        </div>
      </section>
    </main>
  );
}
