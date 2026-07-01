# Release 4.0: Voice Experience Report

## Summary

Release 4.0 adds a voice-first experience layer for TribeApp: random five-minute voice matching, profile reveal after sessions, voice rooms, scheduled rooms, private rooms, and richer voice intro playback controls.

Video was not implemented.

## Implemented

### Random Voice Matching

- Added `POST /api/voice/match`.
- Starts a 5-minute voice session.
- Uses the existing discovery engine, so matching is based on:
  - Personality onboarding
  - Interests
  - Language signals
  - Existing recommendation compatibility
- Stores matching reasons as `matching_basis`.
- Keeps the matched profile hidden until the reveal time.
- Adds a reveal action after the 5-minute session window.

### Voice Sessions

- Added `/voice/match/[sessionId]`.
- Shows session timer.
- Shows match reasons without exposing the profile early.
- Adds microphone permission check.
- Reveals the matched profile after the timer ends.
- Links to the revealed profile afterward.

### Voice Rooms

- Added `/voice`.
- Added `/voice/rooms/[roomId]`.
- Added room APIs:
  - `GET /api/voice/rooms`
  - `POST /api/voice/rooms`
  - `GET /api/voice/rooms/[roomId]`
  - `POST /api/voice/rooms/[roomId]/join`
- Supports:
  - Public rooms
  - Private rooms with invite code foundation
  - Scheduled rooms
- Adds room participants and participant display.
- Adds microphone permission checks.

### Voice Profiles

- Added reusable `VoiceIntroPlayer`.
- Replaced basic browser audio controls with richer controls:
  - Play/pause
  - Progress slider
  - Restart
  - Playback speed
  - Volume
- Added improved playback to:
  - Discovery selected profile panel
  - Profile edit page
  - Public profile page
  - Voice session reveal panel
  - Voice room participant cards

## Database

Added migration:

- `supabase/migrations/20260701000000_release4_voice_experience.sql`

Tables added:

- `voice_sessions`
- `voice_session_participants`
- `voice_rooms`
- `voice_room_participants`

All new tables have RLS enabled and direct anon/authenticated access revoked. Application access remains server-owned through existing Supabase service-role routes.

## API Routes

- `POST /api/voice/match`
- `GET /api/voice/sessions/[sessionId]`
- `POST /api/voice/sessions/[sessionId]/reveal`
- `GET /api/voice/rooms`
- `POST /api/voice/rooms`
- `GET /api/voice/rooms/[roomId]`
- `POST /api/voice/rooms/[roomId]/join`

All voice routes use Clerk-owned profile lookup.

## Files Changed

- `RELEASE4_VOICE_REPORT.md`
- `src/app/api/voice/match/route.ts`
- `src/app/api/voice/rooms/[roomId]/join/route.ts`
- `src/app/api/voice/rooms/[roomId]/route.ts`
- `src/app/api/voice/rooms/route.ts`
- `src/app/api/voice/sessions/[sessionId]/reveal/route.ts`
- `src/app/api/voice/sessions/[sessionId]/route.ts`
- `src/app/page.tsx`
- `src/app/profile/edit/profile-editor.tsx`
- `src/app/profiles/[profileId]/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/voice/match/[sessionId]/page.tsx`
- `src/app/voice/match/[sessionId]/voice-session-client.tsx`
- `src/app/voice/page.tsx`
- `src/app/voice/rooms/[roomId]/page.tsx`
- `src/app/voice/rooms/[roomId]/voice-room-client.tsx`
- `src/app/voice/voice-home-client.tsx`
- `src/components/voice/voice-intro-player.tsx`
- `src/lib/voice/api.ts`
- `src/lib/voice/schema.ts`
- `src/lib/voice/service.ts`
- `src/proxy.ts`
- `supabase/migrations/20260701000000_release4_voice_experience.sql`

## Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

## Notes And Limits

- This release implements the product and database flow for voice sessions and rooms.
- Browser microphone permission is checked with audio-only media access.
- Video is not requested or implemented.
- Realtime voice transport/signaling is not added in this release; the app now has the session, room, participant, and reveal foundations needed for that layer.

## Setup Required Before Testing

Apply the new Supabase migration manually in the Supabase SQL Editor before testing voice sessions or rooms.
