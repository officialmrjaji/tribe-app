import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { OwnedProfile } from "@/lib/profile/service";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  type PaystackVerifiedTransaction,
} from "./paystack";

export type PremiumProductType = "boost" | "premium";

export type PremiumPlan = {
  code: string;
  description: string;
  durationDays: number;
  name: string;
  priceKobo: number;
  productType: PremiumProductType;
  sortOrder: number;
};

type PremiumPurchaseRow = {
  amount_kobo: number;
  created_at: string;
  currency: string;
  id: string;
  metadata: Record<string, unknown>;
  paid_at: string | null;
  plan_code: string;
  product_type: PremiumProductType;
  profile_id: string;
  provider_reference: string;
  status: "abandoned" | "failed" | "pending" | "success";
  user_id: string;
};

type PremiumSubscriptionRow = {
  current_period_end: string;
  current_period_start: string;
  id: string;
  plan_code: string;
  status: "active" | "cancelled" | "expired";
};

type ProfileBoostRow = {
  expires_at: string;
  id: string;
  plan_code: string;
  starts_at: string;
  status: "active" | "cancelled" | "expired";
};

type UsageCounterRow = {
  counter_key: string;
  limit_count: number | null;
  period_end: string;
  period_start: string;
  used_count: number;
};

export type PremiumStatus = {
  activeBoost: {
    endsAt: string;
    planCode: string;
    startsAt: string;
  } | null;
  featureGates: Record<
    | "advancedFilters"
    | "boostVisibility"
    | "incognitoMode"
    | "profileAnalytics"
    | "premiumCommunitiesLater"
    | "seeWhoLikedYou"
    | "seeWhoSavedYou"
    | "unlimitedUndoPass",
    boolean
  >;
  hasActiveBoost: boolean;
  isPremium: boolean;
  premiumBadgeLabel: string | null;
  subscription: {
    endsAt: string;
    planCode: string;
    startsAt: string;
  } | null;
  usageCounters: Array<{
    key: string;
    label: string;
    limit: number | null;
    periodEnd: string;
    used: number;
  }>;
};

export class PremiumError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PremiumError";
    this.status = status;
  }
}

export const premiumPlans = [
  {
    code: "boost_2_weeks",
    description: "Temporarily improves profile visibility for two weeks.",
    durationDays: 14,
    name: "Boost - 2 weeks",
    priceKobo: 120000,
    productType: "boost",
    sortOrder: 10,
  },
  {
    code: "boost_1_month",
    description: "Keeps profile visibility boosted for one month.",
    durationDays: 30,
    name: "Boost - 1 month",
    priceKobo: 200000,
    productType: "boost",
    sortOrder: 20,
  },
  {
    code: "premium_2_weeks",
    description: "Try Tribe Plus discovery controls for two weeks.",
    durationDays: 14,
    name: "Tribe Plus - 2 weeks",
    priceKobo: 150000,
    productType: "premium",
    sortOrder: 30,
  },
  {
    code: "premium_1_month",
    description: "Monthly Tribe Plus access.",
    durationDays: 30,
    name: "Tribe Plus - 1 month",
    priceKobo: 250000,
    productType: "premium",
    sortOrder: 40,
  },
  {
    code: "premium_3_months",
    description: "Three months of Tribe Plus access.",
    durationDays: 90,
    name: "Tribe Plus - 3 months",
    priceKobo: 700000,
    productType: "premium",
    sortOrder: 50,
  },
  {
    code: "premium_6_months",
    description: "Six months of Tribe Plus access.",
    durationDays: 180,
    name: "Tribe Plus - 6 months",
    priceKobo: 1350000,
    productType: "premium",
    sortOrder: 60,
  },
  {
    code: "premium_1_year",
    description: "One year of Tribe Plus access.",
    durationDays: 365,
    name: "Tribe Plus - 1 year",
    priceKobo: 2400000,
    productType: "premium",
    sortOrder: 70,
  },
] satisfies PremiumPlan[];

export const boostPlanOptions = premiumPlans.filter(
  (plan) => plan.productType === "boost",
);
export const premiumPlanOptions = premiumPlans.filter(
  (plan) => plan.productType === "premium",
);

export function getPlanByCode(planCode: string) {
  return premiumPlans.find((plan) => plan.code === planCode) ?? null;
}

export function formatNaira(amountKobo: number) {
  return new Intl.NumberFormat("en-NG", {
    currency: "NGN",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amountKobo / 100);
}

export async function getPremiumStatus(
  ownedProfile: OwnedProfile,
): Promise<PremiumStatus> {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const [subscriptionResult, boostResult] = await Promise.all([
    supabase
      .from("premium_subscriptions")
      .select("id, plan_code, status, current_period_start, current_period_end")
      .eq("user_id", ownedProfile.account.id)
      .eq("status", "active")
      .gt("current_period_end", now)
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profile_boosts")
      .select("id, plan_code, status, starts_at, expires_at")
      .eq("user_id", ownedProfile.account.id)
      .eq("status", "active")
      .gt("expires_at", now)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  if (boostResult.error) {
    throw boostResult.error;
  }

  const subscription =
    (subscriptionResult.data as PremiumSubscriptionRow | null) ?? null;
  const activeBoost = (boostResult.data as ProfileBoostRow | null) ?? null;
  const isPremium = Boolean(subscription);
  const usageCounters = await ensureUsageCounters(ownedProfile, isPremium);

  return {
    activeBoost: activeBoost
      ? {
          endsAt: activeBoost.expires_at,
          planCode: activeBoost.plan_code,
          startsAt: activeBoost.starts_at,
        }
      : null,
    featureGates: {
      advancedFilters: isPremium,
      boostVisibility: Boolean(activeBoost),
      incognitoMode: isPremium,
      profileAnalytics: isPremium,
      premiumCommunitiesLater: isPremium,
      seeWhoLikedYou: isPremium,
      seeWhoSavedYou: isPremium,
      unlimitedUndoPass: isPremium,
    },
    hasActiveBoost: Boolean(activeBoost),
    isPremium,
    premiumBadgeLabel: isPremium ? "Tribe Plus" : null,
    subscription: subscription
      ? {
          endsAt: subscription.current_period_end,
          planCode: subscription.plan_code,
          startsAt: subscription.current_period_start,
        }
      : null,
    usageCounters,
  };
}

export async function initializePremiumCheckout({
  origin,
  ownedProfile,
  planCode,
}: {
  origin: string;
  ownedProfile: OwnedProfile;
  planCode: string;
}) {
  const plan = getPlanByCode(planCode);

  if (!plan) {
    throw new PremiumError("Unknown Tribe Premium plan.", 400);
  }

  const reference = buildPaystackReference();
  const callbackUrl = `${origin.replace(/\/$/, "")}/premium/checkout/verify?reference=${encodeURIComponent(
    reference,
  )}`;
  const supabase = createSupabaseAdminClient();
  const { error: insertError } = await supabase.from("premium_purchases").insert({
    amount_kobo: plan.priceKobo,
    currency: "NGN",
    metadata: {
      durationDays: plan.durationDays,
      planName: plan.name,
    },
    plan_code: plan.code,
    product_type: plan.productType,
    profile_id: ownedProfile.profile.id,
    provider_reference: reference,
    user_id: ownedProfile.account.id,
  });

  if (insertError) {
    throw insertError;
  }

  const checkout = await initializePaystackTransaction({
    amountKobo: plan.priceKobo,
    callbackUrl,
    email: ownedProfile.account.email,
    metadata: {
      planCode: plan.code,
      productType: plan.productType,
      profileId: ownedProfile.profile.id,
      userId: ownedProfile.account.id,
    },
    reference,
  });

  const { error: updateError } = await supabase
    .from("premium_purchases")
    .update({
      provider_access_code: checkout.accessCode,
      provider_authorization_url: checkout.authorizationUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("provider_reference", reference)
    .eq("user_id", ownedProfile.account.id);

  if (updateError) {
    throw updateError;
  }

  return {
    authorizationUrl: checkout.authorizationUrl,
    plan,
    reference,
  };
}

export async function verifyPremiumPurchaseForUser({
  ownedProfile,
  reference,
}: {
  ownedProfile: OwnedProfile;
  reference: string;
}) {
  const result = await verifyPremiumPurchaseByReference(reference);

  if (result.purchase.user_id !== ownedProfile.account.id) {
    throw new PremiumError("This payment does not belong to your account.", 403);
  }

  return {
    ...result,
    status: await getPremiumStatus(ownedProfile),
  };
}

export async function verifyPremiumPurchaseByReference(reference: string) {
  if (!reference.trim()) {
    throw new PremiumError("Payment reference is required.", 400);
  }

  const transaction = await verifyPaystackTransaction(reference);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("premium_purchases")
    .select("*")
    .eq("provider_reference", transaction.reference)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const purchase = data as PremiumPurchaseRow | null;

  if (!purchase) {
    throw new PremiumError("This payment reference was not found.", 404);
  }

  const plan = getPlanByCode(purchase.plan_code);

  if (!plan) {
    throw new PremiumError("The plan for this payment no longer exists.", 500);
  }

  if (!isSuccessfulTransaction(transaction, purchase)) {
    await markPurchaseFailed(purchase, transaction);
    throw new PremiumError("Paystack has not marked this payment as successful.", 402);
  }

  const updatedPurchase = await markPurchaseSuccessful(purchase, transaction);
  await fulfillPurchase(updatedPurchase, plan);

  return {
    fulfilled: true,
    plan,
    purchase: updatedPurchase,
    transaction,
  };
}

export async function restorePremiumPurchases(ownedProfile: OwnedProfile) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("premium_purchases")
    .select("*")
    .eq("user_id", ownedProfile.account.id)
    .eq("status", "success")
    .order("paid_at", { ascending: true });

  if (error) {
    throw error;
  }

  const purchases = (data ?? []) as PremiumPurchaseRow[];

  for (const purchase of purchases) {
    const plan = getPlanByCode(purchase.plan_code);

    if (plan) {
      await fulfillPurchase(purchase, plan);
    }
  }

  return {
    restored: purchases.length,
    status: await getPremiumStatus(ownedProfile),
  };
}

async function fulfillPurchase(purchase: PremiumPurchaseRow, plan: PremiumPlan) {
  if (plan.productType === "premium") {
    await activateSubscription(purchase, plan);
    return;
  }

  await activateBoost(purchase, plan);
}

async function activateSubscription(
  purchase: PremiumPurchaseRow,
  plan: PremiumPlan,
) {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const { data: activeSubscription, error: readError } = await supabase
    .from("premium_subscriptions")
    .select("id, current_period_end")
    .eq("user_id", purchase.user_id)
    .eq("status", "active")
    .gt("current_period_end", now.toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  const start = getLaterDate(
    now,
    parseDate((activeSubscription as { current_period_end?: string } | null)
      ?.current_period_end),
  );
  const end = addDays(start, plan.durationDays);
  const existingId = (activeSubscription as { id?: string } | null)?.id;

  if (existingId) {
    const { error } = await supabase
      .from("premium_subscriptions")
      .update({
        current_period_end: end.toISOString(),
        plan_code: plan.code,
        source_purchase_id: purchase.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("premium_subscriptions").insert({
    current_period_end: end.toISOString(),
    current_period_start: start.toISOString(),
    plan_code: plan.code,
    profile_id: purchase.profile_id,
    source_purchase_id: purchase.id,
    user_id: purchase.user_id,
  });

  if (error) {
    throw error;
  }
}

async function activateBoost(purchase: PremiumPurchaseRow, plan: PremiumPlan) {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const { data: activeBoost, error: readError } = await supabase
    .from("profile_boosts")
    .select("id, expires_at")
    .eq("user_id", purchase.user_id)
    .eq("status", "active")
    .gt("expires_at", now.toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  const start = getLaterDate(
    now,
    parseDate((activeBoost as { expires_at?: string } | null)?.expires_at),
  );
  const end = addDays(start, plan.durationDays);
  const existingId = (activeBoost as { id?: string } | null)?.id;

  if (existingId) {
    const { error } = await supabase
      .from("profile_boosts")
      .update({
        expires_at: end.toISOString(),
        plan_code: plan.code,
        source_purchase_id: purchase.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("profile_boosts").insert({
    expires_at: end.toISOString(),
    plan_code: plan.code,
    profile_id: purchase.profile_id,
    source_purchase_id: purchase.id,
    starts_at: start.toISOString(),
    user_id: purchase.user_id,
  });

  if (error) {
    throw error;
  }
}

async function markPurchaseSuccessful(
  purchase: PremiumPurchaseRow,
  transaction: PaystackVerifiedTransaction,
) {
  const supabase = createSupabaseAdminClient();
  const paidAt = transaction.paidAt ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("premium_purchases")
    .update({
      metadata: {
        ...purchase.metadata,
        paystack: transaction.metadata,
      },
      paid_at: paidAt,
      provider_transaction_id: transaction.transactionId,
      status: "success",
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchase.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as PremiumPurchaseRow;
}

async function markPurchaseFailed(
  purchase: PremiumPurchaseRow,
  transaction: PaystackVerifiedTransaction,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("premium_purchases")
    .update({
      metadata: {
        ...purchase.metadata,
        paystack: transaction.metadata,
      },
      provider_transaction_id: transaction.transactionId,
      status: transaction.status === "abandoned" ? "abandoned" : "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchase.id);

  if (error) {
    throw error;
  }
}

async function ensureUsageCounters(
  ownedProfile: OwnedProfile,
  isPremium: boolean,
) {
  const definitions = buildUsageCounterDefinitions(isPremium);
  const rows = definitions.map((definition) => ({
    counter_key: definition.key,
    limit_count: definition.limit,
    period_end: definition.periodEnd.toISOString(),
    period_start: definition.periodStart.toISOString(),
    profile_id: ownedProfile.profile.id,
    user_id: ownedProfile.account.id,
  }));
  const supabase = createSupabaseAdminClient();
  const { error: upsertError } = await supabase
    .from("premium_usage_counters")
    .upsert(rows, {
      onConflict: "user_id,counter_key,period_start",
    });

  if (upsertError) {
    throw upsertError;
  }

  const { data, error } = await supabase
    .from("premium_usage_counters")
    .select("counter_key, period_start, period_end, used_count, limit_count")
    .eq("user_id", ownedProfile.account.id)
    .in(
      "counter_key",
      definitions.map((definition) => definition.key),
    )
    .gte("period_end", new Date().toISOString());

  if (error) {
    throw error;
  }

  const rowsByKey = new Map(
    ((data ?? []) as UsageCounterRow[]).map((row) => [row.counter_key, row]),
  );

  return definitions.map((definition) => {
    const row = rowsByKey.get(definition.key);

    return {
      key: definition.key,
      label: definition.label,
      limit: row?.limit_count ?? definition.limit,
      periodEnd: row?.period_end ?? definition.periodEnd.toISOString(),
      used: row?.used_count ?? 0,
    };
  });
}

function buildUsageCounterDefinitions(isPremium: boolean) {
  const now = new Date();

  return [
    {
      key: "daily_recommendations",
      label: "Daily recommendations",
      limit: isPremium ? 75 : 15,
      periodEnd: endOfDay(now),
      periodStart: startOfDay(now),
    },
    {
      key: "daily_saves",
      label: "Daily likes",
      limit: isPremium ? 50 : 8,
      periodEnd: endOfDay(now),
      periodStart: startOfDay(now),
    },
    {
      key: "monthly_undo_pass",
      label: "Undo pass",
      limit: isPremium ? null : 1,
      periodEnd: endOfMonth(now),
      periodStart: startOfMonth(now),
    },
  ];
}

function isSuccessfulTransaction(
  transaction: PaystackVerifiedTransaction,
  purchase: PremiumPurchaseRow,
) {
  return (
    transaction.status === "success" &&
    transaction.reference === purchase.provider_reference &&
    transaction.amountKobo >= purchase.amount_kobo &&
    transaction.currency.toUpperCase() === purchase.currency.toUpperCase()
  );
}

function buildPaystackReference() {
  return `tribe_${Date.now()}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = startOfDay(date);
  nextDate.setDate(nextDate.getDate() + 1);

  return nextDate;
}

function startOfMonth(date: Date) {
  const nextDate = new Date(date);
  nextDate.setDate(1);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function endOfMonth(date: Date) {
  const nextDate = startOfMonth(date);
  nextDate.setMonth(nextDate.getMonth() + 1);

  return nextDate;
}

function getLaterDate(left: Date, right: Date | null) {
  if (!right || right.getTime() <= left.getTime()) {
    return left;
  }

  return right;
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
