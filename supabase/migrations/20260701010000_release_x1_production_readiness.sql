alter table public.users
  add column if not exists moderation_status text not null default 'active'
    check (moderation_status in ('active', 'suspended', 'banned', 'shadow_banned')),
  add column if not exists suspended_until timestamptz,
  add column if not exists banned_at timestamptz,
  add column if not exists shadow_banned_at timestamptz,
  add column if not exists moderation_reason text;

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text,
  role text not null default 'admin'
    check (role in ('owner', 'admin', 'moderator', 'support')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid references public.users(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  session_id text,
  request_id text,
  source text not null default 'server'
    check (source in ('client', 'server', 'worker', 'webhook')),
  properties jsonb not null default '{}',
  event_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  session_id text primary key,
  user_id uuid references public.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0
    check (duration_seconds >= 0),
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'
);

create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null
    check (
      subject_type in (
        'user',
        'profile',
        'message',
        'square_post',
        'square_comment',
        'voice_session',
        'voice_room'
      )
    ),
  subject_id uuid,
  subject_user_id uuid references public.users(id) on delete set null,
  reporter_user_id uuid references public.users(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed', 'appealed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  appeal_status text not null default 'none'
    check (appeal_status in ('none', 'submitted', 'reviewing', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.moderation_cases(id) on delete set null,
  moderator_user_id uuid references public.users(id) on delete set null,
  target_user_id uuid references public.users(id) on delete set null,
  target_profile_id uuid references public.profiles(id) on delete set null,
  subject_type text not null,
  subject_id uuid,
  action_type text not null
    check (
      action_type in (
        'user_suspended',
        'user_banned',
        'shadow_banned',
        'content_removed',
        'appeal_status_updated',
        'note'
      )
    ),
  reason text not null,
  expires_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_clerk_user_id text,
  action text not null,
  target_type text not null,
  target_id text,
  request_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  name text not null,
  description text,
  enabled boolean not null default false,
  rollout_percentage integer not null default 0
    check (rollout_percentage between 0 and 100),
  metadata jsonb not null default '{}',
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all'
    check (audience in ('all', 'free', 'premium', 'admins')),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  request_id text,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  user_id uuid references public.users(id) on delete set null,
  route text,
  action text,
  limit_count integer not null,
  remaining integer not null,
  reset_at timestamptz not null,
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.spam_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  content_type text not null,
  content_excerpt text,
  signal_type text not null,
  score integer not null default 0 check (score between 0 and 100),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.application_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  metric_value numeric not null,
  dimensions jsonb not null default '{}',
  recorded_at timestamptz not null default now()
);

create index if not exists users_moderation_status_idx
  on public.users (moderation_status, suspended_until);

create index if not exists admin_roles_active_idx
  on public.admin_roles (active, role);

create index if not exists analytics_events_type_created_idx
  on public.analytics_events (event_type, created_at desc);

create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at desc);

create index if not exists analytics_events_date_type_idx
  on public.analytics_events (event_date, event_type);

create index if not exists app_sessions_user_seen_idx
  on public.app_sessions (user_id, last_seen_at desc);

create index if not exists moderation_cases_status_priority_idx
  on public.moderation_cases (status, priority, created_at desc);

create index if not exists moderation_cases_subject_user_idx
  on public.moderation_cases (subject_user_id, created_at desc);

create index if not exists moderation_actions_target_created_idx
  on public.moderation_actions (target_user_id, created_at desc);

create index if not exists moderation_audit_actor_created_idx
  on public.moderation_audit_log (actor_user_id, created_at desc);

create index if not exists announcements_status_window_idx
  on public.announcements (status, starts_at, ends_at);

create index if not exists security_audit_event_created_idx
  on public.security_audit_log (event_type, created_at desc);

create index if not exists rate_limit_events_key_created_idx
  on public.rate_limit_events (key, created_at desc);

create index if not exists spam_signals_user_created_idx
  on public.spam_signals (user_id, created_at desc);

create index if not exists application_metrics_key_recorded_idx
  on public.application_metrics (metric_key, recorded_at desc);

create index if not exists profiles_display_name_search_idx
  on public.profiles (lower(display_name));

create index if not exists profiles_city_visibility_idx
  on public.profiles (city, visibility, discoverable);

create index if not exists messages_active_conversation_created_idx
  on public.messages (conversation_id, created_at desc)
  where deleted_at is null;

create index if not exists square_posts_active_created_idx
  on public.square_posts (created_at desc, comment_count desc)
  where status = 'active' and deleted_at is null;

create index if not exists voice_rooms_open_schedule_idx
  on public.voice_rooms (status, room_type, scheduled_at, created_at desc);

alter table public.admin_roles enable row level security;
alter table public.analytics_events enable row level security;
alter table public.app_sessions enable row level security;
alter table public.moderation_cases enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.moderation_audit_log enable row level security;
alter table public.feature_flags enable row level security;
alter table public.announcements enable row level security;
alter table public.security_audit_log enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.spam_signals enable row level security;
alter table public.application_metrics enable row level security;

revoke all on public.admin_roles from anon, authenticated;
revoke all on public.analytics_events from anon, authenticated;
revoke all on public.app_sessions from anon, authenticated;
revoke all on public.moderation_cases from anon, authenticated;
revoke all on public.moderation_actions from anon, authenticated;
revoke all on public.moderation_audit_log from anon, authenticated;
revoke all on public.feature_flags from anon, authenticated;
revoke all on public.announcements from anon, authenticated;
revoke all on public.security_audit_log from anon, authenticated;
revoke all on public.rate_limit_events from anon, authenticated;
revoke all on public.spam_signals from anon, authenticated;
revoke all on public.application_metrics from anon, authenticated;
