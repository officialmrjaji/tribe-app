# Voice Mobile Chat Mini Room Report

## Preflight Branch Status

- Branch: `feature/voice-mobile-chat-mini-room`
- Base branch: latest `main`
- Base commit: `31a1366ba7f6219597433761b382940d09712882`
- Main status at branch creation: clean and aligned with `origin/main`
- Existing stash: one unrelated stash remained untouched
- Scope guard: no Square, Discovery, Messaging, Premium, AI, authentication, or onboarding behavior was intentionally changed

## Root Cause Of Hidden Mobile Controls

The Voice Room control bar was fixed to the bottom of the viewport while the mobile navigation also occupied the bottom layer with a higher stacking context. On small screens, the second row of voice controls could sit behind or too close to the bottom navigation/safe-area region. Desktop had enough space, so the issue only appeared on mobile.

## Responsive Control-Bar Solution

- Moved the Voice Room control bar above the mobile navigation with safe-area padding.
- Kept `Mute/Unmute`, `Leave Room`, and host-only `End Room` directly accessible.
- Kept `Participants`, `Room Chat`, `Raise Hand`, and `More` accessible in the mobile grid.
- Added unread badge support to the Room Chat control.
- Preserved host-only End Room confirmation and participant Leave Room confirmation.

## Host And Participant Permission Behavior

- Host keeps the ability to end the room for everyone.
- Participants and moderators can leave without ending the room.
- Non-hosts cannot call host-only room actions through the API because `applyVoiceRoomAction` enforces role checks server-side.
- Moderator controls remain server-validated and cannot be gained by client-submitted role data.
- Leaving or ending clears the active mini-room state locally.

## Room Chat Architecture

- Added a room-scoped `voice_room_messages` table separate from private Chats.
- Added a protected `/api/voice/rooms/[roomId]/chat` route.
- Reads and sends require the signed-in user to be a current active room participant.
- Room chat is available only while the room is open.
- Messages are limited to 500 characters.
- Sends use optimistic UI with rollback on failure.
- Sends are rate limited with the `voice_room_chat_send` key.
- Sends record spam signals with `voice_room_message` as the content type.
- Room chat uses realtime invalidation events and falls back to polling.
- Browser roles still have table access revoked; APIs use server-side ownership checks.

## Room Chat Reporting

- Added `voice_room_message_reports` for room-chat safety reports.
- Added `/api/voice/rooms/[roomId]/chat/[messageId]/report`.
- Users cannot report their own room-chat message.
- Reports require valid room access and membership.
- Report creation records a moderation audit event.

## Migration Details

Created:

- `supabase/migrations/20260715000000_voice_room_chat.sql`

Adds:

- `public.voice_room_messages`
- `public.voice_room_message_reports`
- indexes for room message loading, sender history, report queue, and reporter history
- RLS enabled on new tables
- grants revoked from `anon` and `authenticated`
- `voice_room_messages` added to `supabase_realtime` publication when present

Rollback:

- `VOICE_MOBILE_CHAT_MINI_ROOM_ROLLBACK.sql`

The rollback removes the realtime publication entry, report indexes/table, message indexes/table, and preserves all unrelated Voice Room data.

## Realtime Implementation

- Added `voice_chat` to the realtime invalidation event model.
- The SSE realtime bridge listens for `voice_room_messages` inserts.
- The client receives invalidation only, not private row payloads.
- Open chat drawers refetch messages when a `voice_chat` event arrives.
- Minimized room widgets increment unread chat count when chat is closed.
- Subscriptions are owned by the existing `useRealtimeInvalidation` cleanup flow.

## Mini-Room State Architecture

- Added `ActiveVoiceRoomProvider` at the authenticated navigation shell.
- Tracks one active room per browser session.
- Persists active room id, minimized state, mute state, and widget side in `localStorage`.
- Prevents joining or creating a second room while another active room exists.
- Provides a minimized in-app widget with live status, mute/unmute, restore, reposition, and leave/end controls.
- Uses existing room APIs for restore, leave, and end.
- Cleans up active-room state after leave, end, room close, or sign-out.

## Route Persistence Behavior

- The mini room widget remains available across authenticated app routes.
- Navigating to People, Square, Chats, Settings, Profile, or other app pages does not leave the room.
- Tapping the widget restores the room page.
- Browser refresh attempts to recover the active room from the stored id and server room state.
- Signing out dispatches a local cleanup event that attempts to leave the room before clearing state.

## Security And Privacy Review

- Clerk session context remains required for all room chat APIs.
- Client-submitted user ids are not trusted for chat send/report.
- Room chat reads and sends are member-scoped.
- Removed users and users who left the room lose chat access.
- Block conflicts prevent room chat access while a blocked member is present.
- Private room details are still mediated by existing room access checks.
- Browser roles do not receive direct table grants.
- Realtime emits invalidation events only.
- AI and Premium/payment feature flags were not changed.

## Mobile And Accessibility Review

- Voice controls are reachable above the mobile bottom navigation.
- Controls use icon plus label, title text, and accessible labels.
- The chat drawer uses a bottom-sheet layout on mobile and a centered panel on larger screens.
- The composer remains keyboard-friendly and bounded by the drawer.
- Mini widget respects safe-area spacing and avoids the mobile nav.
- Widget repositioning has a visible button alternative to drag.
- Loading, empty, send failure, and disabled states are visible.

## Test Results

- `npm.cmd run lint`: passed
- `npm.cmd run build`: passed
- `npm.cmd run test:integration`: passed, 8 tests across 7 suites

## Manual Test Checklist

Mobile:

- Host sees End Room
- Participant sees Leave Room
- Moderator sees Leave Room but not End Room
- Voice controls are not hidden behind bottom navigation
- Room chat opens and sends messages
- Keyboard does not cover the composer
- Minimize room
- Navigate to People, Square, Chats, Profile, and Settings
- Restore room
- Mute/unmute from mini widget
- Leave from mini widget
- Host End Room confirmation
- Mini widget disappears after room end
- No duplicate room connection
- No overlap on narrow iPhone/Pixel widths

Desktop:

- All controls remain visible
- Room chat works
- Mini widget works
- Restore and leave work

Security:

- Non-host cannot end room
- Removed participant loses room and chat access
- Users outside the room cannot read room chat
- Signing out clears active room participation
- Joining a second room requires leaving the first

Regression:

- People
- Chats
- Notifications
- Square
- Profile
- Settings
- beta invite access
- feature flags

## Known Browser Limitations

- This is in-app multitasking, not guaranteed background audio outside browser/app limits.
- Browser refresh recovery depends on the room still being open and the session still being valid.
- Microphone state is represented in UI and permission checks; this does not add a new audio transport provider.
- The widget supports side toggling rather than freeform drag to keep touch behavior stable.

## Deferred Capabilities

- Dedicated room-chat moderation queue UI in Admin.
- Rich message actions beyond report.
- Per-room scoped realtime authorization channels.
- True background audio guarantees outside the browser.
- Provider-level active-speaker audio detection.

## Merge Risks

- Requires the new Supabase migration before room chat can work in deployed environments.
- If realtime publication cannot be altered by the migration role, room chat still works through fallback polling but live unread counts may be delayed.
- Manual mobile testing is required on real small screens because the main fix targets viewport and safe-area behavior.

## Rollback Notes

- Use Git/Vercel rollback for application code.
- If the migration has been applied and must be rolled back, run `VOICE_MOBILE_CHAT_MINI_ROOM_ROLLBACK.sql`.
- The rollback deletes room-chat messages and reports only. It does not remove rooms, participants, voice sessions, or normal private messages.
