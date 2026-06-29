create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text not null unique,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  permission_source text not null default 'mutual_save' check (
    permission_source in ('mutual_save', 'manual', 'system')
  ),
  status text not null default 'active' check (
    status in ('active', 'closed')
  ),
  last_message_id uuid,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  archived_at timestamptz,
  muted_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  status text not null default 'sent' check (
    status in ('sent', 'removed', 'moderated')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint messages_body_length check (char_length(btrim(body)) between 1 and 1000)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_last_message_id_fkey'
  ) then
    alter table public.conversations
      add constraint conversations_last_message_id_fkey
      foreign key (last_message_id)
      references public.messages(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.message_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid not null references public.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (
    status in ('open', 'reviewing', 'resolved', 'dismissed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_reports_no_self check (reporter_user_id <> reported_user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  type text not null check (
    type in (
      'new_message',
      'mutual_save',
      'profile_saved',
      'conversation_created'
    )
  ),
  entity_type text not null check (
    entity_type in ('conversation', 'message', 'profile', 'match')
  ),
  entity_id uuid,
  data jsonb not null default '{}',
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists conversations_created_by_user_id_idx
  on public.conversations (created_by_user_id, created_at desc);

create index if not exists conversations_last_message_at_idx
  on public.conversations (last_message_at desc nulls last, updated_at desc);

create index if not exists conversation_members_user_id_idx
  on public.conversation_members (user_id, left_at, conversation_id);

create index if not exists conversation_members_profile_id_idx
  on public.conversation_members (profile_id);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

create index if not exists messages_sender_created_idx
  on public.messages (sender_user_id, created_at desc);

create index if not exists message_reads_user_id_idx
  on public.message_reads (user_id, read_at desc);

create index if not exists message_reports_reporter_created_idx
  on public.message_reports (reporter_user_id, created_at desc);

create index if not exists message_reports_message_id_idx
  on public.message_reports (message_id);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, read_at)
  where read_at is null;

create unique index if not exists notifications_dedupe_key_idx
  on public.notifications (dedupe_key);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.message_reports enable row level security;
alter table public.notifications enable row level security;

revoke all on public.conversations from anon, authenticated;
revoke all on public.conversation_members from anon, authenticated;
revoke all on public.messages from anon, authenticated;
revoke all on public.message_reads from anon, authenticated;
revoke all on public.message_reports from anon, authenticated;
revoke all on public.notifications from anon, authenticated;
