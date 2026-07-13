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
      'square_repost'
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
      'square_comment'
    )
  );

create index if not exists notifications_type_recipient_created_idx
  on public.notifications (recipient_user_id, type, created_at desc);
