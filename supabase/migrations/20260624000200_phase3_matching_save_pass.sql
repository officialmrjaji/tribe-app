create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id uuid not null references public.users(id) on delete cascade,
  candidate_user_id uuid not null references public.users(id) on delete cascade,
  candidate_profile_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  reasons text[] not null default '{}',
  algorithm_version text not null default 'phase3_v1',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recommendations_no_self check (viewer_user_id <> candidate_user_id),
  unique (viewer_user_id, candidate_user_id)
);

create table if not exists public.saved_profiles (
  viewer_user_id uuid not null references public.users(id) on delete cascade,
  saved_user_id uuid not null references public.users(id) on delete cascade,
  saved_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_profiles_no_self check (viewer_user_id <> saved_user_id),
  primary key (viewer_user_id, saved_user_id)
);

create table if not exists public.passed_profiles (
  viewer_user_id uuid not null references public.users(id) on delete cascade,
  passed_user_id uuid not null references public.users(id) on delete cascade,
  passed_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint passed_profiles_no_self check (viewer_user_id <> passed_user_id),
  primary key (viewer_user_id, passed_user_id)
);

create table if not exists public.blocked_users (
  blocker_user_id uuid not null references public.users(id) on delete cascade,
  blocked_user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  constraint blocked_users_no_self check (blocker_user_id <> blocked_user_id),
  primary key (blocker_user_id, blocked_user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid not null references public.users(id) on delete cascade,
  reported_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (
    status in ('open', 'reviewing', 'resolved', 'dismissed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_no_self check (reporter_user_id <> reported_user_id)
);

create index if not exists recommendations_viewer_score_idx
  on public.recommendations (viewer_user_id, score desc, generated_at desc);

create index if not exists recommendations_candidate_user_id_idx
  on public.recommendations (candidate_user_id);

create index if not exists saved_profiles_viewer_created_idx
  on public.saved_profiles (viewer_user_id, created_at desc);

create index if not exists saved_profiles_saved_user_id_idx
  on public.saved_profiles (saved_user_id);

create index if not exists passed_profiles_viewer_created_idx
  on public.passed_profiles (viewer_user_id, created_at desc);

create index if not exists passed_profiles_expires_at_idx
  on public.passed_profiles (expires_at);

create index if not exists blocked_users_blocked_user_id_idx
  on public.blocked_users (blocked_user_id);

create index if not exists reports_reporter_created_idx
  on public.reports (reporter_user_id, created_at desc);

create index if not exists reports_reported_status_idx
  on public.reports (reported_user_id, status);

alter table public.recommendations enable row level security;
alter table public.saved_profiles enable row level security;
alter table public.passed_profiles enable row level security;
alter table public.blocked_users enable row level security;
alter table public.reports enable row level security;

revoke all on public.recommendations from anon, authenticated;
revoke all on public.saved_profiles from anon, authenticated;
revoke all on public.passed_profiles from anon, authenticated;
revoke all on public.blocked_users from anon, authenticated;
revoke all on public.reports from anon, authenticated;
