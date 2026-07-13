alter table public.profiles
  add column if not exists gender text check (
    gender is null
    or gender in (
      'woman',
      'man',
      'non_binary',
      'genderfluid',
      'agender',
      'prefer_not_to_say'
    )
  );

alter table public.onboarding_answers
  add column if not exists gender text check (
    gender is null
    or gender in (
      'woman',
      'man',
      'non_binary',
      'genderfluid',
      'agender',
      'prefer_not_to_say'
    )
  );

create index if not exists profiles_gender_discovery_idx
  on public.profiles (gender, discoverable, visibility)
  where gender is not null;

do $$
declare
  realtime_table text;
  realtime_tables text[] := array[
    'conversation_members',
    'conversations',
    'message_reads',
    'messages',
    'notifications',
    'saved_profiles',
    'square_comment_likes',
    'square_comments',
    'square_likes',
    'square_posts',
    'square_reposts'
  ];
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  foreach realtime_table in array realtime_tables
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        realtime_table
      );
    end if;
  end loop;
end $$;
