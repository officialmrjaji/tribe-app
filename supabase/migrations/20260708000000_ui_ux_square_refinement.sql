alter table public.square_posts
  add column if not exists edited_at timestamptz;

alter table public.square_comments
  add column if not exists parent_comment_id uuid,
  add column if not exists like_count integer not null default 0,
  add column if not exists edited_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'square_comments_parent_comment_id_fkey'
  ) then
    alter table public.square_comments
      add constraint square_comments_parent_comment_id_fkey
      foreign key (parent_comment_id)
      references public.square_comments(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'square_comments_like_count_check'
  ) then
    alter table public.square_comments
      add constraint square_comments_like_count_check
      check (like_count >= 0);
  end if;
end $$;

create table if not exists public.square_comment_likes (
  comment_id uuid not null references public.square_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists square_comments_post_parent_created_idx
  on public.square_comments (post_id, parent_comment_id, created_at)
  where deleted_at is null;

create index if not exists square_comments_author_created_idx
  on public.square_comments (author_user_id, created_at desc);

create index if not exists square_comment_likes_user_created_idx
  on public.square_comment_likes (user_id, created_at desc);

alter table public.square_comment_likes enable row level security;

revoke all on public.square_comment_likes from anon, authenticated;
