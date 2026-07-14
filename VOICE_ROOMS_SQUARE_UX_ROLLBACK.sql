-- Rollback for supabase/migrations/20260713000000_voice_rooms_square_ux.sql
--
-- Correct rollback order:
-- 1. Drop indexes that depend on the new columns or role lookup.
-- 2. Convert any moderator participants back to listener.
-- 3. Restore the previous voice_room_participants role check constraint.
-- 4. Drop the nullable columns added by the migration.
--
-- This preserves all voice room and participant rows. It only removes the
-- temporary room-state columns and converts the new moderator role to listener
-- so the previous role constraint can be restored safely.

begin;

drop index if exists public.voice_room_participants_hand_raised_idx;
drop index if exists public.voice_room_participants_room_role_idx;
drop index if exists public.voice_rooms_status_public_live_idx;

update public.voice_room_participants
set role = 'listener'
where role = 'moderator';

alter table public.voice_room_participants
  drop constraint if exists voice_room_participants_role_check;

alter table public.voice_room_participants
  add constraint voice_room_participants_role_check check (
    role in ('host', 'speaker', 'listener')
  );

alter table public.voice_room_participants
  drop column if exists hand_raised_at,
  drop column if exists speaking_since,
  drop column if exists removed_at;

alter table public.voice_rooms
  drop column if exists locked_at;

commit;
