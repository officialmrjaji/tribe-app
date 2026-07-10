# Trial Version Improvements Report

## Summary

This branch improves the private beta without changing `main`. It adds complete
profile photo management, multi-photo upload progress, onboarding gender
selection, a less restrictive profile-quality gate, authenticated realtime
invalidation, and calmer Square interaction controls.

AI Companion, Premium checkout, Paystack, and the private-beta invite gate are
unchanged.

## Photo Management

- Added a shared profile photo manager for onboarding and profile editing.
- Users can upload several photos in one selection.
- Client and server validate JPEG, PNG, and WebP files up to 10 MB each.
- Upload and replacement actions show percentage progress.
- Existing photos can be replaced.
- Existing photos can be deleted after an inline confirmation.
- Arrow controls move photos earlier or later.
- The first real photo is synchronized to `profiles.avatar_url` and remains the
  primary profile/discovery image.
- Illustrated avatar media cannot be moved ahead of a real profile photo.
- The six-photo maximum remains enforced on both client and server.
- All replace, delete, and reorder queries include the authenticated owner's
  profile ID. Client-submitted profile or user IDs are not trusted.

## Onboarding And Gender

- Added an inclusive gender selection:
  - Woman
  - Man
  - Non-binary
  - Genderfluid
  - Agender
  - Prefer not to say
- Gender is stored on both the profile and onboarding answer.
- Existing users remain valid with a null gender.
- Gender is not added to public profile or discovery response models.
- Added profile photo upload and management as the final onboarding step.
- New users must still provide three real photos before completing onboarding.

## Profile Completion

- Basic People access now requires:
  - completed onboarding
  - at least three real profile photos
  - at least 50% profile completion
  - discoverable visibility for appearing as a candidate
- The quality weighting now lets a new user reach 50% through onboarding,
  three real photos, and enabled visibility even if Clerk did not collect a
  display name.
- The 80% target remains a recommended quality level rather than a hard gate.
- Profile editor copy now distinguishes minimum access from the recommended
  target.
- Candidate queries now accept profiles at 50% or higher.
- Profiles above 50% receive a small, capped recommendation score bonus as
  completion increases.
- Added a `profile_basic_ready` analytics event.

## Realtime Implementation

### Architecture

The browser does not subscribe directly to protected Supabase tables. TribeApp
uses Clerk sessions, and direct Supabase access for `anon` and `authenticated`
roles is intentionally revoked. Weakening those grants would expose private
rows.

Instead:

1. The browser opens one shared same-origin `EventSource` connection to
   `/api/realtime/events`.
2. The route validates the Clerk session and loads the user's conversation
   memberships.
3. A server-only Supabase client subscribes to database changes.
4. The route checks conversation IDs and user IDs before emitting events.
5. The client receives only coarse event names, never database row contents.
6. Each screen refetches through its existing authenticated API.

### Realtime Events

- `messages`
  - new messages
  - conversation updates
  - conversation membership
  - message read state
- `notifications`
  - new notifications
  - notification read-state updates
- `connections`
  - likes
  - mutual-like/match changes
- `square`
  - posts
  - post likes
  - reposts
  - comments
  - replies
  - comment likes

### Consumers

- Chat navigation unread count.
- Notification bell unread count.
- Chats inbox.
- Conversation thread.
- Notifications page.
- Connections page.
- Square feed.
- Square thread.

All browser consumers share one event stream. Each also performs a 45-second
authorized fallback refresh. EventSource reconnect behavior and explicit
cleanup prevent stale subscriptions and memory leaks.

## Square Improvements

- Like uses the Heart icon.
- Comment uses the MessageCircle icon.
- Repost uses the Repeat icon.
- Tapping Comment opens and focuses the comment composer.
- Comments remain directly below their post.
- Replies remain nested beneath their parent comment.
- Post Edit, Delete, Report, Hide, and Block actions moved into a vertical
  three-dot More menu.
- Comment Edit, Delete, and Report actions moved into a More menu.
- Existing ownership and moderation APIs remain authoritative.
- Anonymous authors still expose no profile or user ID through the UI.
- Realtime Square signals contain no post, comment, profile, or author data;
  blocked and hidden-user filtering is reapplied during the API refetch.

## Database Migration

Apply:

```text
supabase/migrations/20260709000000_trial_improvements.sql
```

The migration:

- Adds nullable, constrained `gender` columns to `profiles` and
  `onboarding_answers`.
- Adds a partial discovery index for future gender filtering.
- Idempotently adds messaging, notification, like, and Square tables to the
  `supabase_realtime` publication.
- Does not add client SELECT grants or weaken RLS.

Do not apply this migration to the live production database until the branch
has passed preview testing and is approved for merge.

## Security And Permissions

- Photo mutation routes derive ownership from the Clerk session.
- Photo IDs are filtered by the owned profile ID.
- Realtime clients receive no raw Postgres payloads.
- Message signals are emitted only for conversations in the current user's
  membership set.
- Notification events are filtered to the current recipient.
- Like/match signals are checked against the current user.
- Square uses generic invalidation only and refetches through blocked-user,
  hidden-user, privacy, and moderation filters.
- Existing block, report, private-profile, invite-code, and admin controls are
  unchanged.
- No AI or payment route was enabled.

## General UX Polish

- Photo actions use familiar icon controls with screen-reader labels and
  tooltips.
- Upload errors identify unsupported, empty, or oversized files.
- Success and error messages use the existing TribeApp tone.
- Photo grids remain two columns on narrow mobile screens and expand at larger
  breakpoints.
- Destructive photo deletion uses an explicit confirmation state.
- Square secondary actions no longer crowd the primary interaction row.
- Existing optimistic message sending now deduplicates a possible realtime
  race with the server response.

## Files Changed

- `src/app/api/discover/route.ts`
- `src/app/api/profile/photos/route.ts`
- `src/app/api/profile/photos/[photoId]/route.ts`
- `src/app/api/realtime/events/route.ts`
- `src/app/explore/page.tsx`
- `src/app/messages/[conversationId]/conversation-thread.tsx`
- `src/app/messages/messages-inbox.tsx`
- `src/app/notifications/notifications-page.tsx`
- `src/app/onboarding/onboarding-flow.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/profile/edit/profile-editor.tsx`
- `src/app/settings/page.tsx`
- `src/components/navigation/navigation-frame.tsx`
- `src/components/notifications/notification-badge.tsx`
- `src/components/profile/profile-photo-manager.tsx`
- `src/components/realtime/realtime-page-refresh.tsx`
- `src/components/square/square-feed.tsx`
- `src/components/square/square-post-card.tsx`
- `src/components/square/square-thread.tsx`
- `src/lib/analytics/service.ts`
- `src/lib/discovery/service.ts`
- `src/lib/onboarding/options.ts`
- `src/lib/onboarding/schema.ts`
- `src/lib/onboarding/service.ts`
- `src/lib/profile/schema.ts`
- `src/lib/profile/service.ts`
- `src/lib/realtime/use-realtime-invalidation.ts`
- `src/proxy.ts`
- `supabase/migrations/20260709000000_trial_improvements.sql`
- `TRIAL_IMPROVEMENTS_REPORT.md`

## Verification

- `npm run lint`: passed.
- `npm run build`: passed.
- Next.js production compilation and TypeScript checks passed.
- The new API routes are present in the production route manifest.
- `git diff --check`: passed.

## Manual Testing Checklist

Use a preview Supabase project or approved preview database, apply the new
migration there, and test with two accounts.

### Onboarding

- Sign up with a valid private-beta invite.
- Select every gender option and confirm it saves.
- Confirm an existing profile with null gender still opens.
- Select three photos together and verify progress reaches 100%.
- Confirm unsupported files and files over 10 MB show clear errors.
- Confirm onboarding cannot finish with fewer than three real photos.
- Confirm completing onboarding opens People at 50% or higher.

### Profile Photos

- Upload several photos in one selection.
- Replace the first photo and confirm discovery/profile/Square avatar updates.
- Replace a non-primary photo.
- Move photos earlier and later.
- Confirm supplementary media cannot become the main photo.
- Delete primary and non-primary photos.
- Confirm the next real photo becomes primary after deletion.
- Confirm deleting below three photos closes discovery, liking, and new
  conversation access until quality is restored.
- Attempt another user's photo ID and confirm it returns not found.

### Messaging And Notifications

- Open the same conversation in two browsers.
- Send from account A and confirm account B updates without refresh.
- Confirm inbox ordering and unread counts update.
- Open the thread and confirm read state clears unread counts.
- Create a mutual like and confirm Connections updates.
- Confirm notification page and bell update.
- Temporarily disable Realtime or disconnect the network, reconnect, and
  confirm the fallback refresh recovers.

### Square

- Like and unlike a post from separate accounts.
- Add a comment and a nested reply.
- Like a comment.
- Repost a non-anonymous post.
- Confirm the feed/thread updates without manual refresh.
- Confirm comment icon focuses the composer.
- Confirm owner More menus contain Edit/Delete.
- Confirm non-owner More menus contain Report/Hide/Block as allowed.
- Confirm anonymous posts do not expose profile actions.
- Confirm blocked users remain filtered after realtime refreshes.

### Mobile And Accessibility

- Test narrow iPhone Safari and Android Chrome viewports.
- Test photo selection from the camera roll.
- Confirm photo action labels are announced by a screen reader.
- Navigate More menus and upload controls by keyboard.
- Verify focus moves to the comment composer.
- Test browser zoom at 200%.

## Known Limitations

- Reordering uses explicit earlier/later controls rather than drag and drop.
- Storage cleanup after a successful database deletion is best effort. A failed
  object cleanup can leave an orphaned file but does not restore or expose the
  deleted photo record.
- The server event stream is appropriate for the 10–20 person trial. Vercel
  function duration limits may reconnect the stream periodically; EventSource
  and the fallback refresh handle this.
- Square emits a generic invalidation to all connected beta members. This is
  privacy-safe because no payload is emitted, but a future large-scale release
  should use private Supabase Broadcast topics with first-class Clerk/Supabase
  token integration.
- Realtime will fall back to 45-second refreshes until the migration adds the
  required tables to `supabase_realtime`.
- Gender is stored only as a future matching/filtering foundation and does not
  affect current recommendations.

## Review Before Merging To Main

1. Deploy this branch to a Vercel Preview environment.
2. Point the preview at a non-production Supabase project when possible.
3. Apply `20260709000000_trial_improvements.sql` to that preview database.
4. Complete the two-account checklist above.
5. Confirm Vercel streaming behavior remains stable for at least 20 minutes.
6. Confirm no private rows appear in browser network event payloads.
7. Confirm existing users without gender retain access.
8. Review whether the 50% candidate pool has sufficient profile substance.
9. Review storage for orphaned objects after replace/delete testing.
10. Merge only after explicit approval. This branch must not be auto-merged.
