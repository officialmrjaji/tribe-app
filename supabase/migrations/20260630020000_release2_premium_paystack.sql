create table if not exists public.premium_plans (
  code text primary key,
  product_type text not null check (product_type in ('premium', 'boost')),
  name text not null,
  description text,
  duration_days integer not null check (duration_days > 0),
  price_kobo integer not null check (price_kobo >= 0),
  currency text not null default 'NGN',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.premium_plans (
  code,
  product_type,
  name,
  description,
  duration_days,
  price_kobo,
  currency,
  active,
  sort_order
)
values
  (
    'boost_2_weeks',
    'boost',
    'Boost - 2 weeks',
    'Temporarily improves profile visibility in compatible recommendation pools.',
    14,
    120000,
    'NGN',
    true,
    10
  ),
  (
    'boost_1_month',
    'boost',
    'Boost - 1 month',
    'Keeps profile visibility boosted for one month.',
    30,
    200000,
    'NGN',
    true,
    20
  ),
  (
    'premium_2_weeks',
    'premium',
    'Tribe Plus - 2 weeks',
    'Short Tribe Plus access for trying premium discovery controls.',
    14,
    150000,
    'NGN',
    true,
    30
  ),
  (
    'premium_1_month',
    'premium',
    'Tribe Plus - 1 month',
    'Monthly Tribe Plus access.',
    30,
    250000,
    'NGN',
    true,
    40
  ),
  (
    'premium_3_months',
    'premium',
    'Tribe Plus - 3 months',
    'Three months of Tribe Plus access.',
    90,
    700000,
    'NGN',
    true,
    50
  ),
  (
    'premium_6_months',
    'premium',
    'Tribe Plus - 6 months',
    'Six months of Tribe Plus access.',
    180,
    1350000,
    'NGN',
    true,
    60
  ),
  (
    'premium_1_year',
    'premium',
    'Tribe Plus - 1 year',
    'One year of Tribe Plus access.',
    365,
    2400000,
    'NGN',
    true,
    70
  )
on conflict (code) do update
set
  active = excluded.active,
  currency = excluded.currency,
  description = excluded.description,
  duration_days = excluded.duration_days,
  name = excluded.name,
  price_kobo = excluded.price_kobo,
  product_type = excluded.product_type,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.premium_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_code text not null references public.premium_plans(code),
  product_type text not null check (product_type in ('premium', 'boost')),
  amount_kobo integer not null check (amount_kobo >= 0),
  currency text not null default 'NGN',
  provider text not null default 'paystack' check (provider in ('paystack')),
  provider_reference text not null unique,
  provider_access_code text,
  provider_authorization_url text,
  provider_transaction_id text,
  status text not null default 'pending' check (
    status in ('pending', 'success', 'failed', 'abandoned')
  ),
  paid_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_code text not null references public.premium_plans(code),
  source_purchase_id uuid references public.premium_purchases(id) on delete set null,
  status text not null default 'active' check (
    status in ('active', 'expired', 'cancelled')
  ),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint premium_subscription_period_check check (
    current_period_end > current_period_start
  )
);

create table if not exists public.profile_boosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_code text not null references public.premium_plans(code),
  source_purchase_id uuid references public.premium_purchases(id) on delete set null,
  status text not null default 'active' check (
    status in ('active', 'expired', 'cancelled')
  ),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_boost_period_check check (expires_at > starts_at)
);

create table if not exists public.premium_usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  counter_key text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  used_count integer not null default 0 check (used_count >= 0),
  limit_count integer check (limit_count is null or limit_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint premium_usage_period_check check (period_end > period_start),
  unique (user_id, counter_key, period_start)
);

create index if not exists premium_plans_product_active_idx
  on public.premium_plans (product_type, active, sort_order);

create index if not exists premium_purchases_user_created_idx
  on public.premium_purchases (user_id, created_at desc);

create index if not exists premium_purchases_status_idx
  on public.premium_purchases (status, created_at desc);

create index if not exists premium_subscriptions_user_active_idx
  on public.premium_subscriptions (user_id, current_period_end desc)
  where status = 'active';

create index if not exists premium_subscriptions_profile_active_idx
  on public.premium_subscriptions (profile_id, current_period_end desc)
  where status = 'active';

create index if not exists profile_boosts_user_active_idx
  on public.profile_boosts (user_id, expires_at desc)
  where status = 'active';

create index if not exists profile_boosts_profile_active_idx
  on public.profile_boosts (profile_id, expires_at desc)
  where status = 'active';

create index if not exists premium_usage_user_period_idx
  on public.premium_usage_counters (user_id, counter_key, period_end desc);

alter table public.premium_plans enable row level security;
alter table public.premium_purchases enable row level security;
alter table public.premium_subscriptions enable row level security;
alter table public.profile_boosts enable row level security;
alter table public.premium_usage_counters enable row level security;

revoke all on public.premium_plans from anon, authenticated;
revoke all on public.premium_purchases from anon, authenticated;
revoke all on public.premium_subscriptions from anon, authenticated;
revoke all on public.profile_boosts from anon, authenticated;
revoke all on public.premium_usage_counters from anon, authenticated;
