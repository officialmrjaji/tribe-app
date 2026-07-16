# Voice Random Match UX Refinement Report

## Summary Of Work

This branch refines Voice Rooms and Random Match without changing authentication, onboarding, profiles, Discovery, Square, Messaging, Notifications, Premium, AI, payments, or database schema.

Implemented:

- Replaced the minimized room experience with a circular floating Voice Room widget.
- Added shell-level active Voice Room state for authenticated routes.
- Added Minimize support from the Voice Room page.
- Fixed the Create Room disabled-state issue.
- Simplified Random Match copy and removed the requested explanatory sections.
- Improved mobile Voice Room spacing so controls sit above bottom navigation.
- Added integration contract coverage for the new UX guardrails.

## Root Cause Of Create Room Issue

The Create Room button was disabled by frontend logic when the title field was empty:

- `disabled={pendingAction === "create" || !form.title.trim()}`

There was no evidence of a feature flag, permission, route protection, backend API, or authentication block causing the disabled state. Users could join rooms because joining did not depend on the title field. The fix makes the title optional in the UI and sends a safe default title, `Open Voice Room`, when the field is blank.

## Files Changed

- `src/components/voice/active-voice-room-provider.tsx`
  - New authenticated-shell provider and circular mini-room widget.

- `src/components/navigation/navigation-frame.tsx`
  - Mounts the active Voice Room provider only where main navigation is shown.

- `src/app/voice/rooms/[roomId]/voice-room-client.tsx`
  - Registers active room state, adds Minimize, uses shared mute state, clears widget on leave/end, and adjusts mobile bottom spacing.

- `src/app/voice/voice-home-client.tsx`
  - Makes room title optional, prevents a second active room in one session, and registers created/joined rooms.

- `src/app/voice/match/[sessionId]/voice-session-client.tsx`
  - Simplifies Random Match intro copy and removes the Reveal Rule and hidden Profile Reveal sections.

- `tests/integration/voice.integration.test.mjs`
  - Adds contract tests for creatable rooms, mini-room shell mounting, and simplified Random Match copy.

- `VOICE_RANDOMMATCH_UX_REFINEMENT_REPORT.md`
  - This report.

## UI Improvements

- Mini room is now a circular floating widget inspired by AssistiveTouch/chat-head patterns while keeping Tribe's sea-green design language.
- Widget shows a live indicator and mute state.
- Widget supports tap to restore, long press/context menu for quick actions, drag movement, and edge snapping.
- Quick actions include Restore, Mute/Unmute, and Leave/End Room with confirmation.
- Voice Room page includes a compact Minimize action.
- Random Match now focuses on the timer and action flow instead of redundant instructional cards.

## Accessibility Improvements

- Mini widget and quick actions use accessible labels and button semantics.
- Long press is not the only path to quick actions; a visible More button is available.
- Critical actions keep visible labels in the quick-action menu.
- Existing keyboard-accessible Voice Room controls remain available.
- Reduced-motion users still receive functional interactions without relying on animation.

## Mobile Improvements

- Voice Room control bar now sits above the mobile navigation and safe-area region.
- Main Voice Room content has additional bottom padding so controls do not cover content.
- Floating widget avoids bottom navigation by default and snaps to screen edges.
- Widget position is remembered for the current browser session.

## Performance Considerations

- The mini-room provider fetches only the active room snapshot.
- Existing Voice realtime invalidation is reused.
- Fallback polling remains unchanged.
- No new broad subscriptions or duplicate room sessions are introduced.
- Position state is session-scoped and lightweight.

## Regression Testing

Automated checks run:

- `npm.cmd run lint`: passed
- `npm.cmd run build`: passed
- `npm.cmd run test:integration`: passed, 9 tests across 7 suites

Manual checklist to run on preview:

Voice Rooms:

- Create room with blank title
- Create room with custom title
- Join room
- Leave room
- End room as host
- Minimize room
- Restore room
- Drag widget
- Snap widget to both edges
- Mute/unmute from widget
- Host quick actions
- Participant quick actions
- Moderator controls

Random Match:

- Page loads
- Simplified copy displays correctly
- Removed instructional sections are gone
- Continue Talking still works
- Reveal flow remains unchanged
- Mobile layout
- Desktop layout

Regression:

- Chats
- Square
- Discovery
- Profile
- Notifications
- Settings
- Beta invite
- Feature flags

## Known Limitations

- The mini widget represents in-app continuity only; it does not guarantee background audio outside browser limitations.
- Widget repositioning is edge-snapped rather than free-floating after release.
- Room chat unread badge is not shown on this branch because room chat is not part of this focused branch from `main`.
- Browser refresh recovery depends on the user still being a valid active participant in the room.

## Merge Risks

- Medium: mobile widget positioning should be verified on narrow iPhone/Pixel widths and landscape.
- Low: Create Room now uses a default title when blank; product copy should be reviewed if a different default title is preferred.
- Low: active-room session state is browser-session scoped and clears naturally when the session ends or room is no longer accessible.

## Database Changes

No database migration was required.

Rollback SQL was not created because no database changes were made.
