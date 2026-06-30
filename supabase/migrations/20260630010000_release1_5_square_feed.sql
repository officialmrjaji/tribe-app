create table if not exists public.square_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references public.users(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  post_type text not null check (
    post_type in (
      'thought',
      'photo',
      'question',
      'anonymous_thought',
      'poll',
      'recommendation'
    )
  ),
  body text,
  caption text,
  image_url text,
  image_storage_path text,
  is_anonymous boolean not null default false,
  visibility text not null default 'members' check (
    visibility in ('members', 'discoverable')
  ),
  city text,
  status text not null default 'active' check (
    status in ('active', 'hidden', 'under_review', 'removed', 'author_deleted')
  ),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  repost_count integer not null default 0 check (repost_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint square_post_body_or_media check (
    body is not null
    or caption is not null
    or image_url is not null
  ),
  constraint square_anonymous_text_only check (
    is_anonymous = false
    or (
      post_type = 'anonymous_thought'
      and image_url is null
      and image_storage_path is null
    )
  )
);

create table if not exists public.square_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.square_posts(id) on delete cascade,
  author_user_id uuid not null references public.users(id) on delete cascade,
  author_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  status text not null default 'active' check (
    status in ('active', 'hidden', 'under_review', 'removed', 'author_deleted')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint square_comments_body_length check (
    char_length(btrim(body)) between 1 and 1000
  )
);

create table if not exists public.square_likes (
  post_id uuid not null references public.square_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.square_reposts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.square_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  commentary text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint square_repost_commentary_length check (
    commentary is null
    or char_length(btrim(commentary)) between 1 and 280
  )
);

create table if not exists public.square_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.square_posts(id) on delete cascade,
  comment_id uuid references public.square_comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.users(id) on delete cascade,
  mentioned_by_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint square_mentions_target check (
    post_id is not null
    or comment_id is not null
  )
);

create table if not exists public.square_topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'active' check (
    status in ('active', 'hidden', 'under_review')
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.square_post_topics (
  post_id uuid not null references public.square_posts(id) on delete cascade,
  topic_id uuid not null references public.square_topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, topic_id)
);

create table if not exists public.square_polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.square_posts(id) on delete cascade,
  question text not null,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  constraint square_poll_question_length check (
    char_length(btrim(question)) between 4 and 240
  )
);

create table if not exists public.square_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.square_polls(id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint square_poll_option_body_length check (
    char_length(btrim(body)) between 1 and 120
  )
);

create table if not exists public.square_poll_votes (
  poll_id uuid not null references public.square_polls(id) on delete cascade,
  option_id uuid not null references public.square_poll_options(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table if not exists public.square_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid references public.square_posts(id) on delete cascade,
  comment_id uuid references public.square_comments(id) on delete cascade,
  reported_user_id uuid not null references public.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (
    status in ('open', 'reviewing', 'resolved', 'dismissed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint square_reports_target check (
    post_id is not null
    or comment_id is not null
  ),
  constraint square_reports_no_self check (reporter_user_id <> reported_user_id)
);

create table if not exists public.square_mutes (
  muter_user_id uuid not null references public.users(id) on delete cascade,
  muted_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint square_mutes_no_self check (muter_user_id <> muted_user_id),
  primary key (muter_user_id, muted_user_id)
);

create unique index if not exists square_reposts_active_unique_idx
  on public.square_reposts (post_id, user_id)
  where deleted_at is null;

create index if not exists square_posts_feed_idx
  on public.square_posts (status, created_at desc)
  where deleted_at is null;

create index if not exists square_posts_author_created_idx
  on public.square_posts (author_user_id, created_at desc);

create index if not exists square_comments_post_created_idx
  on public.square_comments (post_id, created_at)
  where deleted_at is null;

create index if not exists square_likes_user_id_idx
  on public.square_likes (user_id, created_at desc);

create index if not exists square_reposts_user_created_idx
  on public.square_reposts (user_id, created_at desc)
  where deleted_at is null;

create index if not exists square_mentions_mentioned_user_idx
  on public.square_mentions (mentioned_user_id, created_at desc);

create index if not exists square_post_topics_topic_idx
  on public.square_post_topics (topic_id, created_at desc);

create index if not exists square_poll_options_poll_sort_idx
  on public.square_poll_options (poll_id, sort_order);

create index if not exists square_poll_votes_option_idx
  on public.square_poll_votes (option_id, created_at desc);

create index if not exists square_reports_reporter_created_idx
  on public.square_reports (reporter_user_id, created_at desc);

create index if not exists square_reports_status_idx
  on public.square_reports (status, created_at desc);

alter table public.square_posts enable row level security;
alter table public.square_comments enable row level security;
alter table public.square_likes enable row level security;
alter table public.square_reposts enable row level security;
alter table public.square_mentions enable row level security;
alter table public.square_topics enable row level security;
alter table public.square_post_topics enable row level security;
alter table public.square_polls enable row level security;
alter table public.square_poll_options enable row level security;
alter table public.square_poll_votes enable row level security;
alter table public.square_reports enable row level security;
alter table public.square_mutes enable row level security;

revoke all on public.square_posts from anon, authenticated;
revoke all on public.square_comments from anon, authenticated;
revoke all on public.square_likes from anon, authenticated;
revoke all on public.square_reposts from anon, authenticated;
revoke all on public.square_mentions from anon, authenticated;
revoke all on public.square_topics from anon, authenticated;
revoke all on public.square_post_topics from anon, authenticated;
revoke all on public.square_polls from anon, authenticated;
revoke all on public.square_poll_options from anon, authenticated;
revoke all on public.square_poll_votes from anon, authenticated;
revoke all on public.square_reports from anon, authenticated;
revoke all on public.square_mutes from anon, authenticated;

insert into public.square_topics (name, slug, description)
values
  ('Friendship', 'friendship', 'Making and maintaining grounded friendships.'),
  ('Networking', 'networking', 'Professional relationships without performative hustle.'),
  ('Weekend plans', 'weekend-plans', 'Low-pressure things to do together.'),
  ('Lagos', 'lagos', 'Local discovery around Lagos.'),
  ('Books', 'books', 'Reading, recommendations, and ideas.'),
  ('Fitness', 'fitness', 'Movement, wellness, and active plans.'),
  ('Language exchange', 'language-exchange', 'Language learning and cultural exchange.'),
  ('Creative life', 'creative-life', 'Art, design, music, writing, and creative rhythm.'),
  ('Food spots', 'food-spots', 'Places to eat, meet, and recommend.'),
  ('Questions', 'questions', 'Open questions for thoughtful replies.')
on conflict (slug) do update
set
  description = excluded.description,
  name = excluded.name,
  status = 'active';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'square-media',
  'square-media',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
