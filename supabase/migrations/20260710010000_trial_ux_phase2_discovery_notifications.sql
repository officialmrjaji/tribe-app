alter table public.saved_profiles
  add column if not exists rediscover_after timestamptz;

update public.saved_profiles
set rediscover_after = coalesce(
  rediscover_after,
  created_at + interval '90 days'
)
where rediscover_after is null;

create index if not exists saved_profiles_rediscover_after_idx
  on public.saved_profiles (viewer_user_id, rediscover_after);

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'new_message',
      'mutual_save',
      'profile_saved',
      'conversation_created',
      'square_comment',
      'square_reply',
      'square_mention',
      'square_like',
      'square_repost',
      'system_announcement',
      'feature_update',
      'account_security'
    )
  );

alter table public.notifications
  drop constraint if exists notifications_entity_type_check;

alter table public.notifications
  add constraint notifications_entity_type_check check (
    entity_type in (
      'conversation',
      'message',
      'profile',
      'match',
      'square_post',
      'square_comment',
      'system'
    )
  );

create index if not exists notifications_recipient_non_message_unread_idx
  on public.notifications (recipient_user_id, read_at, created_at desc)
  where read_at is null
    and type not in ('new_message', 'conversation_created');
