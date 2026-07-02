"use client";

import {
  ArrowLeft,
  BarChart3,
  Check,
  Crown,
  EyeOff,
  Filter,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PremiumBadge } from "@/components/premium/premium-badge";
import type { PremiumPlan, PremiumStatus } from "@/lib/premium/service";

type UpgradePageClientProps = {
  boostPlans: PremiumPlan[];
  initialStatus: PremiumStatus;
  premiumPlans: PremiumPlan[];
};

type CheckoutPayload = {
  authorizationUrl?: string;
  error?: string;
};

type RestorePayload = {
  error?: string;
  restored?: number;
  status?: PremiumStatus;
};

const premiumFeatures = [
  {
    body: "Know who already signaled interest before you decide who to like.",
    icon: ShieldCheck,
    label: "See who liked you",
  },
  {
    body: "Undo passes without being limited to only the most recent action.",
    icon: RefreshCcw,
    label: "Unlimited undo pass",
  },
  {
    body: "Filter with more precision while keeping matching personality-first.",
    icon: Filter,
    label: "Advanced filters",
  },
  {
    body: "Understand how your profile performs without chasing vanity metrics.",
    icon: BarChart3,
    label: "Profile analytics",
  },
  {
    body: "Browse more quietly when you want more privacy.",
    icon: EyeOff,
    label: "Incognito mode",
  },
] as const;

export default function UpgradePageClient({
  boostPlans,
  initialStatus,
  premiumPlans,
}: UpgradePageClientProps) {
  const [checkoutPlanCode, setCheckoutPlanCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<
    "idle" | "loading" | "ready"
  >("idle");
  const [status, setStatus] = useState(initialStatus);
  const activeStatusText = useMemo(() => {
    if (status.subscription) {
      return `Tribe Plus active until ${formatDate(status.subscription.endsAt)}.`;
    }

    return "You are currently on Tribe Free.";
  }, [status.subscription]);

  async function startCheckout(planCode: string) {
    setCheckoutPlanCode(planCode);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/premium/checkout", {
        body: JSON.stringify({ planCode }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | CheckoutPayload
        | null;

      if (!response.ok || !payload?.authorizationUrl) {
        throw new Error(payload?.error ?? "Unable to start checkout.");
      }

      window.location.assign(payload.authorizationUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start checkout.",
      );
      setCheckoutPlanCode(null);
    }
  }

  async function restorePurchases() {
    setRestoreStatus("loading");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/premium/restore", {
        headers: { Accept: "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | RestorePayload
        | null;

      if (!response.ok || !payload?.status) {
        throw new Error(payload?.error ?? "Unable to restore purchases.");
      }

      setStatus(payload.status);
      setMessage(
        payload.restored
          ? `Restored ${payload.restored} completed purchase${
              payload.restored === 1 ? "" : "s"
            }.`
          : "No completed purchases needed restoring.",
      );
      setRestoreStatus("ready");
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Unable to restore purchases.",
      );
      setRestoreStatus("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/"
            >
              <ArrowLeft size={16} />
              Discovery
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Crown size={16} />
              Tribe Premium
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Upgrade discovery without changing the tone.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              Tribe Plus unlocks more control, insight, and visibility while
              keeping core matching, messaging, and safety free.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/premium/manage"
            >
              Manage
            </Link>
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
              disabled={restoreStatus === "loading"}
              onClick={restorePurchases}
              type="button"
            >
              {restoreStatus === "loading" ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <RefreshCcw size={16} />
              )}
              Restore purchases
            </button>
          </div>
        </header>

        {error ? <Notice message={error} tone="error" /> : null}
        {!error && message ? <Notice message={message} tone="success" /> : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {status.isPremium ? (
                <PremiumBadge label={status.premiumBadgeLabel} />
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#edf2e9] px-2 py-1 text-xs font-bold text-[#34443a]">
                  <Sparkles size={13} />
                  Tribe Free
                </span>
              )}
              {status.hasActiveBoost ? <PremiumBadge boost /> : null}
            </div>
            <h2 className="mt-4 text-xl font-semibold">Subscription status</h2>
            <p className="mt-2 text-sm leading-6 text-[#34443a]">
              {activeStatusText}
            </p>
            {status.activeBoost ? (
              <p className="mt-2 text-sm leading-6 text-[#34443a]">
                Boost active until {formatDate(status.activeBoost.endsAt)}.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-[#34443a]">
                No boost is active right now.
              </p>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
          </div>

          <div className="rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Premium gates</h2>
            <div className="mt-4 space-y-2">
              {Object.entries({
                "See who liked you": status.featureGates.seeWhoLikedYou,
                "Unlimited undo pass": status.featureGates.unlimitedUndoPass,
                "Advanced filters": status.featureGates.advancedFilters,
                "Profile analytics": status.featureGates.profileAnalytics,
                "Incognito mode": status.featureGates.incognitoMode,
                "Boost visibility": status.featureGates.boostVisibility,
              }).map(([label, enabled]) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border border-[#e2e6dc] px-3 py-2 text-sm"
                  key={label}
                >
                  <span className="font-semibold text-[#34443a]">{label}</span>
                  <span
                    className={
                      enabled
                        ? "font-bold text-[#2f5f36]"
                        : "font-semibold text-[#8a3325]"
                    }
                  >
                    {enabled ? "Unlocked" : "Locked"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
            <Crown size={16} />
            Tribe Plus
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {premiumPlans.map((plan) => (
              <PlanCard
                busy={checkoutPlanCode === plan.code}
                key={plan.code}
                onCheckout={() => startCheckout(plan.code)}
                plan={plan}
              />
            ))}
          </div>
        </section>

        <section className="mt-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
            <Zap size={16} />
            Boost visibility
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {boostPlans.map((plan) => (
              <PlanCard
                busy={checkoutPlanCode === plan.code}
                key={plan.code}
                onCheckout={() => startCheckout(plan.code)}
                plan={plan}
              />
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#607265]">
            What Tribe Plus unlocks
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {premiumFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3"
                  key={feature.label}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Icon size={16} />
                    {feature.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#34443a]">
                    {feature.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function PlanCard({
  busy,
  onCheckout,
  plan,
}: {
  busy: boolean;
  onCheckout: () => void;
  plan: PremiumPlan;
}) {
  return (
    <article className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-[#607265]">
        {plan.productType === "premium" ? "Premium" : "Boost"}
      </p>
      <h3 className="mt-1 text-lg font-semibold">{plan.name}</h3>
      <p className="mt-2 text-2xl font-bold">{formatCurrency(plan.priceKobo)}</p>
      <p className="mt-2 text-sm leading-6 text-[#34443a]">
        {plan.description}
      </p>
      <p className="mt-2 text-xs font-semibold uppercase text-[#607265]">
        {plan.durationDays} days
      </p>
      <button
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
        disabled={busy}
        onClick={onCheckout}
        type="button"
      >
        {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
        Choose plan
      </button>
    </article>
  );
}

function Notice({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success";
}) {
  return (
    <p
      className={
        tone === "error"
          ? "mt-4 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]"
          : "mt-4 rounded-md border border-[#94c973] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f36]"
      }
    >
      {message}
    </p>
  );
}

function formatCurrency(amountKobo: number) {
  return new Intl.NumberFormat("en-NG", {
    currency: "NGN",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amountKobo / 100);
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
