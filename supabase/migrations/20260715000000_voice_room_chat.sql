create table if not exists public.voice_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.voice_rooms(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  status text not null default 'sent' check (
    status in ('sent', 'removed', 'moderated')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint voice_room_messages_body_length check (
    char_length(btrim(body)) between 1 and 500
  )
);

create index if not exists voice_room_messages_room_created_idx
  on public.voice_room_messages (room_id, created_at desc);

create index if not exists voice_room_messages_sender_created_idx
  on public.voice_room_messages (sender_user_id, created_at desc);

create table if not exists public.voice_room_message_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.voice_rooms(id) on delete cascade,
  message_id uuid not null references public.voice_room_messages(id) on delete cascade,
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid not null references public.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (
    status in ('open', 'reviewing', 'resolved', 'dismissed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_room_message_reports_no_self check (
    reporter_user_id <> reported_user_id
  )
);

create index if not exists voice_room_message_reports_room_created_idx
  on public.voice_room_message_reports (room_id, created_at desc);

create index if not exists voice_room_message_reports_status_created_idx
  on public.voice_room_message_reports (status, created_at desc);

create index if not exists voice_room_message_reports_reporter_created_idx
  on public.voice_room_message_reports (reporter_user_id, created_at desc);

alter table public.voice_room_messages enable row level security;
alter table public.voice_room_message_reports enable row level security;

revoke all on public.voice_room_messages from anon, authenticated;
revoke all on public.voice_room_message_reports from anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'voice_room_messages'
  ) then
    alter publication supabase_realtime
      add table public.voice_room_messages;
  end if;
end $$;
