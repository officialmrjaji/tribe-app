# TribeApp Database Schema

Date: June 23, 2026

## Recommendation

Use Postgres as the primary database. TribeApp has relational product needs: users, profiles, traits, values, circles, recommendations, saves, blocks, reports, conversations, and messages. Postgres also leaves room for future vector search through `pgvector` and location search through PostGIS.

This schema is a recommended target design. The current codebase does not yet include a database or backend.

## Design Principles

- Store identity separately from public profile data.
- Use coarse location by default.
- Make privacy and moderation status first-class fields.
- Keep messaging permissioned.
- Store recommendation explanations for auditability.
- Support AI embeddings without making them required for MVP.
- Prefer soft-delete or status fields for user-generated social data.

## Suggested Enums

```sql
create type user_status as enum ('active', 'pending', 'suspended', 'deleted');
create type profile_visibility as enum ('private', 'members', 'discoverable');
create type moderation_status as enum ('pending', 'approved', 'flagged', 'removed');
create type conversation_status as enum ('pending', 'active', 'archived', 'blocked');
create type report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type circle_visibility as enum ('private', 'invite_only', 'discoverable');
```

## Core Tables

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  phone text,
  auth_provider_id text unique,
  status user_status not null default 'pending',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table profiles (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text not null,
  birthdate date not null,
  city text,
  region text,
  country text,
  location_label text,
  avatar_url text,
  bio text,
  archetype text,
  temperament_summary text,
  social_pace text,
  profile_visibility profile_visibility not null default 'private',
  moderation_status moderation_status not null default 'pending',
  discoverable boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profile_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  discovery_radius_km integer,
  location_precision text not null default 'city',
  min_age integer,
  max_age integer,
  preferred_pace text,
  relationship_intents text[] not null default '{}',
  notification_settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
```

## Personality And Discovery Data

```sql
create table traits (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  category text not null,
  active boolean not null default true
);

create table profile_traits (
  user_id uuid references users(id) on delete cascade,
  trait_id uuid references traits(id) on delete cascade,
  weight integer not null default 1,
  source text not null default 'user',
  created_at timestamptz not null default now(),
  primary key (user_id, trait_id)
);

create table values_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  active boolean not null default true
);

create table profile_values (
  user_id uuid references users(id) on delete cascade,
  value_id uuid references values_catalog(id) on delete cascade,
  rank integer,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, value_id)
);

create table interests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  category text,
  active boolean not null default true
);

create table profile_interests (
  user_id uuid references users(id) on delete cascade,
  interest_id uuid references interests(id) on delete cascade,
  weight integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (user_id, interest_id)
);
```

## Prompts And Availability

```sql
create table prompts (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table profile_prompt_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  prompt_id uuid not null references prompts(id),
  answer text not null,
  visibility profile_visibility not null default 'members',
  moderation_status moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table availability_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  cadence text not null default 'weekly',
  visibility profile_visibility not null default 'members',
  created_at timestamptz not null default now()
);
```

## Circles

```sql
create table circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete set null,
  name text not null,
  description text,
  city text,
  visibility circle_visibility not null default 'invite_only',
  moderation_status moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table circle_memberships (
  circle_id uuid references circles(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
```

## Discovery And Recommendations

```sql
create table discovery_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  signal_type text not null,
  payload jsonb not null default '{}',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references users(id) on delete cascade,
  candidate_id uuid not null references users(id) on delete cascade,
  score numeric(5,2) not null,
  reasons jsonb not null default '[]',
  model_version text not null default 'rules-v1',
  shown_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (viewer_id, candidate_id, model_version)
);

create table saves (
  viewer_id uuid references users(id) on delete cascade,
  candidate_id uuid references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_id, candidate_id)
);

create table passes (
  viewer_id uuid references users(id) on delete cascade,
  candidate_id uuid references users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (viewer_id, candidate_id)
);

create table blocks (
  blocker_id uuid references users(id) on delete cascade,
  blocked_id uuid references users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
```

## Messaging

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct',
  status conversation_status not null default 'pending',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table conversation_members (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null,
  moderation_status moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table message_reactions (
  message_id uuid references messages(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, reaction)
);
```

## Moderation And Audit

```sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id) on delete cascade,
  reported_user_id uuid references users(id) on delete set null,
  reported_message_id uuid references messages(id) on delete set null,
  category text not null,
  details text,
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null,
  action text not null,
  subject_type text not null,
  subject_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

## AI And Search Support

```sql
create table embeddings (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid not null,
  embedding vector(1536),
  model text not null,
  created_at timestamptz not null default now(),
  unique (owner_type, owner_id, model)
);
```

If `pgvector` is not added during MVP, keep this table out of the first migration and add it when AI-assisted discovery begins.

## Recommended Indexes

```sql
create index profiles_discoverable_idx on profiles (discoverable, profile_visibility, moderation_status);
create index profiles_city_idx on profiles (city, region, country);
create index recommendations_viewer_shown_idx on recommendations (viewer_id, shown_at desc);
create index recommendations_candidate_idx on recommendations (candidate_id);
create index messages_conversation_created_idx on messages (conversation_id, created_at desc);
create index conversation_members_user_idx on conversation_members (user_id, last_read_at);
create index reports_status_created_idx on reports (status, created_at);
create index discovery_signals_user_expires_idx on discovery_signals (user_id, expires_at);
```

## MVP Migration Order

1. Users and profiles.
2. Preferences, traits, values, interests.
3. Prompts and prompt answers.
4. Saves, passes, blocks.
5. Recommendations.
6. Conversations and messages.
7. Reports and audit events.
8. Embeddings and AI support.

