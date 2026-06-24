create extension if not exists pgcrypto;

do $$
begin
  create type public.user_status as enum ('active', 'pending', 'suspended', 'deleted');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.profile_visibility as enum ('private', 'members', 'discoverable');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text not null,
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  clerk_user_id text not null unique,
  display_name text,
  birthdate date,
  city text,
  region text,
  country text,
  avatar_url text,
  bio text,
  archetype text,
  temperament_summary text,
  social_pace text,
  visibility public.profile_visibility not null default 'private',
  discoverable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  discovery_radius_km integer,
  location_precision text not null default 'city',
  min_age integer,
  max_age integer,
  preferred_pace text,
  relationship_intents text[] not null default '{}',
  notification_settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_interests (
  user_id uuid not null references public.users(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  weight integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (user_id, interest_id)
);

create table if not exists public.profile_ownership_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists users_clerk_user_id_idx on public.users (clerk_user_id);
create index if not exists profiles_user_id_idx on public.profiles (user_id);
create index if not exists profiles_clerk_user_id_idx on public.profiles (clerk_user_id);
create index if not exists profiles_discoverable_idx on public.profiles (discoverable, visibility);
create index if not exists user_interests_user_id_idx on public.user_interests (user_id);

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_preferences enable row level security;
alter table public.interests enable row level security;
alter table public.user_interests enable row level security;
alter table public.profile_ownership_audit enable row level security;

revoke all on public.users from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.profile_preferences from anon, authenticated;
revoke all on public.interests from anon, authenticated;
revoke all on public.user_interests from anon, authenticated;
revoke all on public.profile_ownership_audit from anon, authenticated;
