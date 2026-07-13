alter table public.voice_rooms
  add column if not exists locked_at timestamptz;

alter table public.voice_room_participants
  add column if not exists hand_raised_at timestamptz,
  add column if not exists speaking_since timestamptz,
  add column if not exists removed_at timestamptz;

alter table public.voice_room_participants
  drop constraint if exists voice_room_participants_role_check;

alter table public.voice_room_participants
  add constraint voice_room_participants_role_check check (
    role in ('host', 'moderator', 'speaker', 'listener')
  );

create index if not exists voice_rooms_status_public_live_idx
  on public.voice_rooms (status, room_type, locked_at, created_at desc)
  where room_type = 'public';

create index if not exists voice_room_participants_room_role_idx
  on public.voice_room_participants (room_id, role, joined_at desc)
  where left_at is null;

create index if not exists voice_room_participants_hand_raised_idx
  on public.voice_room_participants (room_id, hand_raised_at)
  where hand_raised_at is not null and left_at is null;
