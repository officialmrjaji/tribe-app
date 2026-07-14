# Voice Rooms and Square UX Redesign Report

## Preflight Branch Status

- Working branch: `feature/voice-rooms-square-ux`
- Base branch used: `post-production/square-chat-polish`
- Base commit: `c5b6f73d2b154bfab5b2c8840e13b9ecfa9ba646`
- `main` was not checked out, merged into, or pushed to during this work.
- Prior post-production polish changes were preserved separately on `post-production/square-chat-polish` before this feature branch was created.
- Production environment variables were not changed.
- AI and Premium payment gates were not enabled.

## Summary of Changes

- Redesigned Voice Rooms with a calmer live-room layout, participant grid, sticky control bar, room info drawer behavior, and participant profile drawer.
- Added server-backed Voice Room actions for raise hand, speaker approval, moderator promotion/demotion, participant removal, room lock/unlock, leave, and end room.
- Added Voice Room realtime invalidation support through the existing server-sent events foundation, with client polling fallback.
- Improved live public room discovery cards with host, status, capacity, lock/full state, participant previews, and realtime refresh.
- Removed the create-room instructional copy and hid the language field from the create room form while preserving backend compatibility.
- Refined Square comment interactions with continuous thread styling, inline More actions, hide/block actions for comment authors, and safer optimistic comment-like handling.
- Updated the stale discovery integration contract so it matches the current beta completion gate constant.

## Files Changed

- `src/app/api/realtime/events/route.ts`
- `src/app/api/voice/rooms/[roomId]/actions/route.ts`
- `src/app/voice/rooms/[roomId]/voice-room-client.tsx`
- `src/app/voice/voice-home-client.tsx`
- `src/components/square/square-post-card.tsx`
- `src/lib/realtime/use-realtime-invalidation.ts`
- `src/lib/voice/schema.ts`
- `src/lib/voice/service.ts`
- `tests/integration/discovery.integration.test.mjs`
- `supabase/migrations/20260713000000_voice_rooms_square_ux.sql`

## Voice Architecture Used

- Existing voice room membership remains Supabase-backed and Clerk-session protected through existing server APIs.
- The new `/api/voice/rooms/[roomId]/actions` route accepts a narrow action schema and delegates all permission checks to server-side voice service logic.
- Live room updates use the existing authenticated realtime invalidation stream. The browser receives only an invalidation event and then refetches authorized room data through API routes.
- The UI remains voice-only. No video or fake audio-provider controls were added.

## Existing vs Newly Added Voice Capabilities

Existing:

- Public, private, and scheduled room creation.
- Room joining with invite code support for private rooms.
- Voice room participant records.
- Host/listener/speaker roles.
- Random voice matching remains separate from Voice Rooms.

New or refined:

- Responsive participant grid with profile photo fallback, host badge, moderator badge, speaker state, raised hand state, and muted indicator.
- Sticky bottom control bar with Mute/Unmute, Participants, disabled Room Chat placeholder, Raise Hand, More, and Leave/End.
- Raise hand and cancel raise hand.
- Host/moderator approval and rejection of speaking requests.
- Host promotion/demotion of moderators.
- Host/moderator participant removal.
- Host lock/unlock room.
- Host end room with confirmation.
- Participant profile drawer with permitted profile preview, full profile link, report, and block actions.
- Server-side prevention of removed participants immediately rejoining.

## Deferred Features

- Actual audio transport, active speaker detection, and remote microphone enforcement are deferred until a real audio provider is integrated.
- Room Chat remains deferred because no secure room-chat subsystem exists yet.
- Host ownership transfer is deferred because the current schema has `host_user_id` on the room and needs a dedicated, audited transfer flow before enabling it.
- Deleting rooms is deferred; hosts can end rooms safely.
- Follow, friend request, and mutual connection controls are omitted because those systems do not currently exist.
- Provider-level reconnect quality, noise suppression, and device selection are deferred.
- Square reply pagination is currently progressive client reveal using loaded comments, not server-page-by-server-page reply loading.

## API Changes

- Added `POST /api/voice/rooms/[roomId]/actions`.
- Supported actions:
  - `raise_hand`
  - `cancel_raise_hand`
  - `approve_speaker`
  - `reject_speaker`
  - `remove_participant`
  - `promote_moderator`
  - `demote_moderator`
  - `lock_room`
  - `unlock_room`
  - `leave_room`
  - `end_room`

## Migrations Created

`supabase/migrations/20260713000000_voice_rooms_square_ux.sql`

Adds:

- `voice_rooms.locked_at`
- `voice_room_participants.hand_raised_at`
- `voice_room_participants.speaking_since`
- `voice_room_participants.removed_at`
- Updated `voice_room_participants_role_check` to include `moderator`
- `voice_rooms_status_public_live_idx`
- `voice_room_participants_room_role_idx`
- `voice_room_participants_hand_raised_idx`

The migration is additive except for replacing the participant role check constraint so `moderator` is accepted.

## Role and Permission Model

- Host is derived from `voice_rooms.host_user_id`, not from client-submitted role state.
- Host-only actions: lock/unlock, end room, promote moderator, demote moderator.
- Host or moderator actions: approve/reject speaker requests and remove participants.
- Moderators cannot change host or moderator status.
- Participants can raise or cancel their own hand.
- Hosts cannot raise hand because they already control the room.
- Sensitive room actions are recorded through the moderation audit foundation.

## Realtime Implementation

- Added `voice` to the central realtime invalidation event union.
- Added server-side subscriptions for `voice_rooms` and `voice_room_participants`.
- Voice pages listen for `voice` invalidation events and refetch through authorized API routes.
- Fallback refresh intervals are used so the interface still updates if realtime is unavailable.
- No protected row contents are sent directly through the realtime event payload.

## Square Comment Architecture

- The existing flat comment data remains unchanged.
- The client builds the thread tree and renders comments as a lightweight continuous discussion.
- Replies are indented with subtle connector lines and capped visual depth.
- Inline actions now emphasize Like, Reply, and More.
- Comment author hide/block actions are available through the More menu where permitted.
- Comment like updates are optimistic and roll back on failure.

## Pagination Behavior

- Main Square feed stays compact and does not render complete threads.
- Dedicated post pages render full loaded comments and progressively reveal replies in small batches.
- Further server-side reply pagination is recommended for very large threads.

## Performance Changes

- Voice live room lists are deduplicated after refresh.
- Voice room state uses invalidation plus controlled refetching instead of exposing direct row payloads.
- Square comment replies avoid showing every reply at once in the UI.
- Optimistic like updates avoid unnecessary full post refetches.

## Security and Privacy Review

- Clerk-session ownership checks remain in place through protected API context.
- Client-submitted user IDs are only used as target IDs and are checked server-side against actual room participants.
- Host/moderator permissions are enforced server-side.
- Private room invite-code checks remain server-side.
- Removed participants cannot immediately rejoin the same room.
- Participant profile drawers link to existing profile routes and do not expose hidden internal account fields.
- Block and report actions continue to use existing protected profile APIs.
- Supabase RLS and Storage permissions were not weakened.
- AI, Premium, payment, invite-code beta access, and unrelated authentication flows were not changed.

## Mobile and Accessibility Review

- Voice participant tiles use large touch targets and accessible labels.
- Icon-led room controls include labels and titles.
- The bottom control bar is sticky and responsive across small screens.
- Square inline actions remain visible and are not gesture-only.
- Reduced-motion-safe transitions were kept subtle and brief.
- Missing avatars fall back to clear profile icons.

## Manual Test Checklist

Voice:

- Create public, private, and scheduled rooms.
- Browse public live rooms and confirm ended/private rooms do not appear.
- Join and leave a public room.
- Join a private room with the correct invite code.
- Confirm locked and full rooms cannot be joined.
- Raise and lower hand as a listener.
- Approve and reject a speaking request as host.
- Promote and demote a moderator as host.
- Remove a participant as host/moderator.
- Confirm removed participant cannot immediately rejoin.
- Lock and unlock a room as host.
- End a room as host.
- Open participant profile drawer while staying in room.
- Report and block a participant.
- Verify realtime/polling updates room cards and participant grid.

Square:

- Add a top-level comment.
- Add an inline reply.
- Expand and collapse long comments.
- Expand reply batches with `View more replies`.
- Like and unlike a comment and confirm rollback on failed request.
- Use comment More menu for edit/delete as owner.
- Use comment More menu for report/hide/block as non-owner.
- Verify mobile layout for long discussions.

## Known Limitations

- Voice Rooms do not yet provide real WebRTC/live audio transport controls.
- Local mute state is UI/microphone-permission level only.
- Muting another participant is not exposed because it cannot be securely enforced without provider support.
- Room Chat is intentionally disabled and deferred.
- Host transfer is intentionally deferred.
- Square reply pagination is client-side progressive reveal, not database-level pagination.

## Merge Risks

- The Voice migration must be applied before deploying this branch; otherwise the new role values and room state columns will fail at runtime.
- Existing active room rows should remain compatible, but rooms created before migration will not have lock/hand/speaking state until users interact.
- A real audio provider integration should be planned before describing Voice Rooms as full live audio.

## Rollback Notes

- Roll back application code by reverting the merge commit or redeploying the previous Vercel production deployment.
- Database rollback, if required before user activity depends on the new fields:
  - remove the added indexes;
  - restore the old `voice_room_participants_role_check` without `moderator`;
  - drop `locked_at`, `hand_raised_at`, `speaking_since`, and `removed_at` if no data must be retained.
- Prefer leaving additive columns in place during an application rollback unless they are actively causing production issues.

## Verification

- `npm.cmd run lint`: passed
- `npm.cmd run build`: passed
- `npm.cmd run test:integration`: passed
