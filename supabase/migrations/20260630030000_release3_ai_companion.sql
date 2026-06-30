create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  feature_type text not null check (
    feature_type in (
      'profile_coach',
      'match_coach',
      'conversation_coach',
      'safety_check'
    )
  ),
  model text not null,
  input_summary text,
  output jsonb not null default '{}',
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_safety_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null default 'message' check (
    content_type in ('message', 'profile', 'square_post', 'comment', 'other')
  ),
  input_excerpt text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  categories jsonb not null default '{}',
  recommendation text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_suggestions_user_feature_created_idx
  on public.ai_suggestions (user_id, feature_type, created_at desc);

create index if not exists ai_suggestions_profile_created_idx
  on public.ai_suggestions (profile_id, created_at desc);

create index if not exists ai_safety_checks_user_created_idx
  on public.ai_safety_checks (user_id, created_at desc);

create index if not exists ai_safety_checks_risk_created_idx
  on public.ai_safety_checks (risk_level, created_at desc);

alter table public.ai_suggestions enable row level security;
alter table public.ai_safety_checks enable row level security;

revoke all on public.ai_suggestions from anon, authenticated;
revoke all on public.ai_safety_checks from anon, authenticated;
