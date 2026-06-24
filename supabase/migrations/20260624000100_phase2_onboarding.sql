create table if not exists public.onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  primary_goal text not null,
  intent text not null check (
    intent in (
      'friends',
      'networking',
      'dating',
      'activity_partner',
      'language_exchange'
    )
  ),
  personality_type text not null check (
    personality_type in ('introvert', 'ambivert', 'extrovert')
  ),
  lifestyle_signals text[] not null default '{}',
  interests text[] not null default '{}',
  conversation_style text not null check (
    conversation_style in (
      'deep_dives',
      'light_first',
      'voice_notes',
      'plan_oriented',
      'curiosity_led'
    )
  ),
  availability text not null check (
    availability in (
      'weekday_mornings',
      'weeknights',
      'weekends',
      'spontaneous',
      'scheduled'
    )
  ),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_goal_length check (char_length(primary_goal) between 8 and 180),
  constraint onboarding_lifestyle_count check (cardinality(lifestyle_signals) between 2 and 8),
  constraint onboarding_interests_count check (cardinality(interests) between 3 and 12)
);

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

create index if not exists onboarding_answers_user_id_idx
  on public.onboarding_answers (user_id);

create index if not exists onboarding_answers_profile_id_idx
  on public.onboarding_answers (profile_id);

create index if not exists onboarding_answers_completed_at_idx
  on public.onboarding_answers (completed_at);

create index if not exists user_interests_interest_id_idx
  on public.user_interests (interest_id);

alter table public.onboarding_answers enable row level security;

revoke all on public.onboarding_answers from anon, authenticated;
