-- Rollback for supabase/migrations/20260715000000_voice_room_chat.sql
--
-- Correct rollback order:
-- 1. Remove voice_room_messages from realtime publication, if present.
-- 2. Drop indexes that depend on voice_room_messages.
-- 3. Drop voice_room_messages.
--
-- This removes room-chat history. Run only if the feature must be fully
-- rolled back and message retention is not required.

begin;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'voice_room_messages'
  ) then
    alter publication supabase_realtime
      drop table public.voice_room_messages;
  end if;
end $$;

drop index if exists public.voice_room_messages_sender_created_idx;
drop index if exists public.voice_room_messages_room_created_idx;
drop index if exists public.voice_room_message_reports_reporter_created_idx;
drop index if exists public.voice_room_message_reports_status_created_idx;
drop index if exists public.voice_room_message_reports_room_created_idx;

drop table if exists public.voice_room_message_reports;
drop table if exists public.voice_room_messages;

commit;
