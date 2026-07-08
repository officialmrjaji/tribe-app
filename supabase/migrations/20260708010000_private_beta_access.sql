create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (
    used_count >= 0 and used_count <= max_uses
  ),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invite_codes_code_length check (
    char_length(btrim(code)) between 6 and 64
  )
);

create unique index if not exists invite_codes_code_normalized_idx
  on public.invite_codes (lower(btrim(code)));

create index if not exists invite_codes_active_expiry_idx
  on public.invite_codes (active, expires_at);

create table if not exists public.beta_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_code_id uuid not null references public.invite_codes(id) on delete restrict,
  user_id uuid not null unique references public.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (invite_code_id, user_id)
);

create index if not exists beta_invite_redemptions_code_redeemed_idx
  on public.beta_invite_redemptions (invite_code_id, redeemed_at desc);

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (
    category in (
      'bug',
      'confusing',
      'idea',
      'performance',
      'safety',
      'other'
    )
  ),
  rating integer not null check (rating between 1 and 5),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  screenshot_or_link text check (
    screenshot_or_link is null
    or char_length(screenshot_or_link) <= 500
  ),
  status text not null default 'new' check (
    status in ('new', 'reviewing', 'resolved', 'dismissed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists beta_feedback_status_created_idx
  on public.beta_feedback (status, created_at desc);

create index if not exists beta_feedback_user_created_idx
  on public.beta_feedback (user_id, created_at desc);

alter table public.invite_codes enable row level security;
alter table public.beta_invite_redemptions enable row level security;
alter table public.beta_feedback enable row level security;

revoke all on public.invite_codes from anon, authenticated;
revoke all on public.beta_invite_redemptions from anon, authenticated;
revoke all on public.beta_feedback from anon, authenticated;

create or replace function public.redeem_beta_invite(
  p_code text,
  p_user_id uuid
)
returns table (
  result text,
  invite_code_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_code public.invite_codes%rowtype;
begin
  select *
  into selected_code
  from public.invite_codes
  where lower(btrim(code)) = lower(btrim(p_code))
  for update;

  if not found then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  if exists (
    select 1
    from public.beta_invite_redemptions
    where user_id = p_user_id
  ) then
    return query select 'already_redeemed'::text, selected_code.id;
    return;
  end if;

  if not selected_code.active then
    return query select 'inactive'::text, selected_code.id;
    return;
  end if;

  if selected_code.expires_at is not null
    and selected_code.expires_at <= now() then
    return query select 'expired'::text, selected_code.id;
    return;
  end if;

  if selected_code.used_count >= selected_code.max_uses then
    return query select 'full'::text, selected_code.id;
    return;
  end if;

  insert into public.beta_invite_redemptions (
    invite_code_id,
    user_id
  )
  values (
    selected_code.id,
    p_user_id
  );

  update public.invite_codes
  set used_count = used_count + 1
  where id = selected_code.id;

  return query select 'redeemed'::text, selected_code.id;
end;
$$;

revoke all on function public.redeem_beta_invite(text, uuid)
  from public, anon, authenticated;
grant execute on function public.redeem_beta_invite(text, uuid)
  to service_role;
