import {
  ArrowLeft,
  BarChart3,
  Crown,
  RefreshCcw,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import {
  formatNaira,
  getPlanByCode,
  getPremiumStatus,
} from "@/lib/premium/service";

export default async function PremiumManagePage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const status = await getPremiumStatus(session.ownedProfile);
  const subscriptionPlan = status.subscription
    ? getPlanByCode(status.subscription.planCode)
    : null;
  const boostPlan = status.activeBoost
    ? getPlanByCode(status.activeBoost.planCode)
    : null;

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/premium"
            >
              <ArrowLeft size={16} />
              Premium
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Crown size={16} />
              Subscription management
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Tribe Premium status
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              Review active Tribe Plus access, boosts, premium gates, and usage
              counters. Purchases can be restored from the upgrade page.
            </p>
          </div>
          <Link
            className="flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
            href="/premium"
          >
            Upgrade
          </Link>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <StatusPanel
            body={
              status.subscription
                ? `${subscriptionPlan?.name ?? "Tribe Plus"} is active until ${formatDate(
                    status.subscription.endsAt,
                  )}.`
                : "You are on Tribe Free. Core matching, messaging, and safety remain available."
            }
            icon={Crown}
            title="Premium"
          >
            {status.isPremium ? (
              <PremiumBadge label={status.premiumBadgeLabel} />
            ) : null}
            {subscriptionPlan ? (
              <p className="mt-3 text-sm font-semibold text-[#607265]">
                Plan price: {formatNaira(subscriptionPlan.priceKobo)}
              </p>
            ) : null}
          </StatusPanel>

          <StatusPanel
            body={
              status.activeBoost
                ? `${boostPlan?.name ?? "Boost"} is active until ${formatDate(
                    status.activeBoost.endsAt,
                  )}.`
                : "No visibility boost is active."
            }
            icon={Zap}
            title="Boost"
          >
            {status.hasActiveBoost ? <PremiumBadge boost /> : null}
            {boostPlan ? (
              <p className="mt-3 text-sm font-semibold text-[#607265]">
                Plan price: {formatNaira(boostPlan.priceKobo)}
              </p>
            ) : null}
          </StatusPanel>
        </section>

        <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
            <BarChart3 size={16} />
            Usage counters
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {status.usageCounters.map((counter) => (
              <div
                className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3"
                key={counter.key}
              >
                <p className="text-xs font-semibold uppercase text-[#607265]">
                  {counter.label}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {counter.used}
                  {counter.limit === null ? "" : ` / ${counter.limit}`}
                </p>
                <p className="mt-1 text-xs text-[#607265]">
                  Resets {formatDate(counter.periodEnd)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
            <ShieldCheck size={16} />
            Subscription controls
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Link
              className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3 transition hover:border-[#9dad9f]"
              href="/premium"
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <RefreshCcw size={16} />
                Restore purchases
              </p>
              <p className="mt-2 text-sm leading-6 text-[#34443a]">
                Use the restore button on the upgrade page to re-apply completed
                Paystack payments to your account.
              </p>
            </Link>
            <div className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3">
              <p className="text-sm font-semibold">Cancellation</p>
              <p className="mt-2 text-sm leading-6 text-[#34443a]">
                Self-serve cancellation is foundation-only in this release.
                Existing access remains active until the current period ends.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusPanel({
  body,
  children,
  icon: Icon,
  title,
}: {
  body: string;
  children?: ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
        <Icon size={16} />
        {title}
      </p>
      <p className="mt-3 text-sm leading-6 text-[#34443a]">{body}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "soon";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
