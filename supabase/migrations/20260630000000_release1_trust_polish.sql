alter table public.profiles
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists identity_verified_at timestamptz;

update public.profiles
set email_verified_at = verified_at
where email_verified_at is null
  and verified_at is not null;

create index if not exists profiles_email_verified_at_idx
  on public.profiles (email_verified_at);

create index if not exists profiles_phone_verified_at_idx
  on public.profiles (phone_verified_at);

create index if not exists profiles_identity_verified_at_idx
  on public.profiles (identity_verified_at);
