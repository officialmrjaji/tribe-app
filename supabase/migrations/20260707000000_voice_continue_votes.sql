create table if not exists public.voice_session_continue_votes (
  session_id uuid not null references public.voice_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists voice_session_continue_votes_user_idx
  on public.voice_session_continue_votes (user_id, created_at desc);

alter table public.voice_session_continue_votes enable row level security;

revoke all on public.voice_session_continue_votes from anon, authenticated;
