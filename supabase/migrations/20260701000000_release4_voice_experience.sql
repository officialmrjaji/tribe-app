create table if not exists public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  initiator_user_id uuid not null references public.users(id) on delete cascade,
  initiator_profile_id uuid not null references public.profiles(id) on delete cascade,
  matched_user_id uuid not null references public.users(id) on delete cascade,
  matched_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (
    status in ('active', 'completed', 'cancelled')
  ),
  matching_basis text[] not null default '{}',
  language_signal text,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  reveal_profiles_after timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_sessions_no_self check (initiator_user_id <> matched_user_id),
  constraint voice_sessions_period_check check (ends_at > started_at),
  constraint voice_sessions_reveal_check check (reveal_profiles_after >= started_at)
);

create table if not exists public.voice_session_participants (
  session_id uuid not null references public.voice_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  revealed_at timestamptz,
  primary key (session_id, user_id)
);

create table if not exists public.voice_rooms (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references public.users(id) on delete cascade,
  host_profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  room_type text not null default 'public' check (
    room_type in ('public', 'private', 'scheduled')
  ),
  status text not null default 'open' check (
    status in ('scheduled', 'open', 'closed', 'cancelled')
  ),
  topic text,
  language text,
  invite_code text unique,
  scheduled_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  max_participants integer not null default 12 check (
    max_participants between 2 and 50
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_rooms_schedule_check check (
    room_type <> 'scheduled' or scheduled_at is not null
  )
);

create table if not exists public.voice_room_participants (
  room_id uuid not null references public.voice_rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'listener' check (
    role in ('host', 'speaker', 'listener')
  ),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  muted_at timestamptz,
  primary key (room_id, user_id)
);

create index if not exists voice_sessions_initiator_created_idx
  on public.voice_sessions (initiator_user_id, created_at desc);

create index if not exists voice_sessions_matched_created_idx
  on public.voice_sessions (matched_user_id, created_at desc);

create index if not exists voice_sessions_status_ends_idx
  on public.voice_sessions (status, ends_at);

create index if not exists voice_session_participants_user_idx
  on public.voice_session_participants (user_id, joined_at desc);

create index if not exists voice_rooms_status_type_idx
  on public.voice_rooms (status, room_type, scheduled_at nulls last);

create index if not exists voice_rooms_host_created_idx
  on public.voice_rooms (host_user_id, created_at desc);

create index if not exists voice_room_participants_user_idx
  on public.voice_room_participants (user_id, joined_at desc);

create index if not exists voice_room_participants_room_joined_idx
  on public.voice_room_participants (room_id, joined_at desc);

alter table public.voice_sessions enable row level security;
alter table public.voice_session_participants enable row level security;
alter table public.voice_rooms enable row level security;
alter table public.voice_room_participants enable row level security;

revoke all on public.voice_sessions from anon, authenticated;
revoke all on public.voice_session_participants from anon, authenticated;
revoke all on public.voice_rooms from anon, authenticated;
revoke all on public.voice_room_participants from anon, authenticated;
