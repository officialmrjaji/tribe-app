alter table public.profiles
  add column if not exists profile_completion_score integer not null default 0
    check (profile_completion_score between 0 and 100),
  add column if not exists verified_at timestamptz,
  add column if not exists voice_intro_url text,
  add column if not exists voice_intro_storage_path text,
  add column if not exists voice_intro_duration_seconds integer
    check (
      voice_intro_duration_seconds is null
      or voice_intro_duration_seconds between 30 and 60
    );

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  storage_path text,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, storage_path)
);

create table if not exists public.profile_prompts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  prompt_key text not null,
  prompt_text text not null,
  answer text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_prompt_answer_length check (
    char_length(answer) between 2 and 240
  ),
  unique (profile_id, prompt_key)
);

create index if not exists profiles_completion_discovery_idx
  on public.profiles (profile_completion_score, discoverable, visibility);

create index if not exists profiles_verified_at_idx
  on public.profiles (verified_at);

create index if not exists profile_photos_profile_sort_idx
  on public.profile_photos (profile_id, sort_order, created_at);

create unique index if not exists profile_photos_one_primary_idx
  on public.profile_photos (profile_id)
  where is_primary;

create index if not exists profile_prompts_profile_sort_idx
  on public.profile_prompts (profile_id, sort_order);

alter table public.profile_photos enable row level security;
alter table public.profile_prompts enable row level security;

revoke all on public.profile_photos from anon, authenticated;
revoke all on public.profile_prompts from anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-media',
  'profile-media',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
    'audio/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
