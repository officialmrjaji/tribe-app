# Trial UX Phase 2 Report

## Summary

Implemented Trial UX Phase 2 on `trial/ux-phase2-discovery-square-notifications`, based on `trial/ux-profile-people-square-notifications`.

This pass refined People discovery, identity display/locking, full-profile discovery actions, rediscovery timing, notification scope, and Square feed readability without enabling AI, Premium payments, or changing private beta access.

## Files Changed

- `src/app/api/discover/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/notifications/notifications-page.tsx`
- `src/app/page.tsx`
- `src/app/profile/edit/profile-editor.tsx`
- `src/app/profiles/[profileId]/page.tsx`
- `src/components/media/safe-storage-image.tsx`
- `src/components/profile/public-profile-actions.tsx`
- `src/components/profile/profile-photo-gallery.tsx`
- `src/components/profile/profile-photo-manager.tsx`
- `src/components/profile/public-profile-view.tsx`
- `src/components/discovery/profile-collection-grid.tsx`
- `src/components/square/square-post-card.tsx`
- `src/lib/discovery/schema.ts`
- `src/lib/discovery/service.ts`
- `src/lib/messaging/service.ts`
- `src/lib/notifications/service.ts`
- `src/lib/onboarding/service.ts`
- `src/lib/profile/public-profile.ts`
- `src/lib/profile/service.ts`
- `src/lib/voice/service.ts`
- `supabase/migrations/20260710010000_trial_ux_phase2_discovery_notifications.sql`

## Migrations Created

`supabase/migrations/20260710010000_trial_ux_phase2_discovery_notifications.sql`

Adds:

- `saved_profiles.rediscover_after`
- Backfill for existing likes using `created_at + interval '90 days'`
- Index for saved-profile rediscovery lookup
- Expanded notification type/entity constraints for non-message platform activity
- Unread non-message notification index

Apply this migration before testing the branch in a deployed preview.

## Identity-Field Enforcement

- Public profiles now show gender subtly near name, age, and location when available.
- Existing users without gender remain supported; unset gender is hidden publicly.
- Profile Edit no longer allows editing Display Name, Gender, or Date of Birth after onboarding.
- The edit UI explains that identity fields are fixed after onboarding.
- `/api/profile` now rejects attempts to change locked identity fields after onboarding.
- Onboarding preserves existing gender if a completed user somehow resubmits onboarding.
- Date of Birth remains private; public UI only uses calculated age.

## Filter Implementation

- People now uses a single Filter button.
- Removed the People page search field, Chats shortcut, Connections shortcut, and Edit Profile shortcut.
- Basic free filters:
  - Gender
  - Minimum age
  - Maximum age
- Advanced filters are visible but locked as Premium:
  - Interests
  - Personality
  - Lifestyle
  - Availability
  - Location
  - Goals
- Filters are validated server-side and persisted in browser local storage.
- Gender and age filters affect Discovery only. Square remains open and unaffected.

## Discovery Card and Full Profile Changes

- Compact People cards now show only:
  - Primary photo
  - Display name
  - Calculated age
  - Location
  - Gender when set
  - Personality/intent summary
  - One or two connection reasons
  - Verification/recent activity indicators
  - Like, Pass, and View Profile actions
- Raw numeric compatibility score is de-emphasized.
- Dense bio, prompts, interests, lifestyle, goals, voice intro, and score breakdown stay on the full profile page.
- Full member profile pages now include Like and Pass actions for other members.
- Like/Pass from the full profile uses the same protected API routes as People.

## Rediscovery Logic

- Likes now set `saved_profiles.rediscover_after`.
- Passes now set `passed_profiles.expires_at`.
- Default rediscovery window is 90 days.
- `TRIBE_REDISCOVERY_DAYS` can change the window later, including 180 days, without schema changes.
- Active liked/passed profiles are excluded from the People queue.
- Rediscovery is silent and does not affect matches, messaging, Square, blocks, or reports.

## Notification Changes

- Message notifications are no longer created when conversations are created or messages are sent.
- Voice matching no longer creates generic conversation-start notifications.
- Notifications list and unread count exclude old `new_message` and `conversation_created` rows safely.
- Message activity remains in Chats through message tables, unread counts, and realtime invalidation.
- Notifications remain focused on likes, mutual likes, Square comments/replies/mentions/interactions, and platform/account updates.

## Square UX Changes

- Removed the main-feed `Open discussion` action.
- Feed post body/caption area opens `/square/posts/[postId]`.
- Comment icon still deep-links to the post detail page.
- Icon actions remain independent.
- Long post text is truncated in the main feed with `Read more`.
- Full content remains visible on post detail pages.
- Comment threads have clearer top-level comment cards and nested reply grouping.
- Square media viewer behavior is preserved.

## Profile Image Delivery Fix

- Investigated failing `/_next/image` responses for Supabase-hosted profile media.
- Confirmed `profile_photos` rows and `profile-media` storage objects were present and direct public Storage URLs returned image responses.
- Next development logs showed the image optimizer rejecting valid Supabase Storage URLs because the upstream host resolved through IPv6/NAT64 addresses classified as private by the optimizer.
- Added a shared safe Storage image component that bypasses Next image optimization for Supabase Storage URLs while keeping normal image rendering for other sources.
- Added graceful fallback UI for unavailable profile, avatar, gallery, and Square media images.
- No storage bucket policy was changed.
- No database cleanup is required for the tested records because the objects and paths are valid.

## Security and Privacy Notes

- No client-submitted user IDs are trusted.
- Discovery filters are parsed and validated on the server.
- Identity-field locking is enforced in the server profile update flow.
- Blocking, visibility, report, ownership, and moderation rules are preserved.
- Square filtering is intentionally not tied to gender or discovery preferences.
- AI remains disabled by feature gates.
- Premium payments remain disabled by feature gates.
- Private beta invite-code access is unchanged.

## Mobile and Accessibility Review

- People filters use labeled controls and accessible buttons.
- Compact cards keep icon-only actions labeled.
- Full-profile Like/Pass actions have clear loading, success, and error states.
- Square post cards preserve keyboard access for opening post detail.
- Advanced locked filters remain visible without creating a payment flow.

## Known Limitations

- Existing users missing Date of Birth cannot self-correct it after onboarding in this branch; this matches the locked-identity requirement but should be paired with an admin/manual correction process later.
- Rediscovered liked profiles may still show as already liked if the like record remains active after the rediscovery window.
- Advanced filters are presentation-locked only; actual premium filter behavior remains deferred until Premium is enabled.
- Vercel preview URL is not available locally until the branch push triggers deployment.

## Deferred Recommendations

- Add admin identity correction workflow.
- Add explicit discovery preference model for future saved filters.
- Add notification preferences per category.
- Add Square comment anchor highlighting on deep link.
- Add end-to-end tests for two-user mutual-like/chat flows.

## Manual Test Checklist

Two-user checks:

- User A and User B both complete onboarding and have eligible profile quality.
- User A filters People by gender and age; only matching Discovery candidates appear.
- User A confirms Square feed still shows all community posts regardless of filters.
- User A opens User B profile from People and sees back link to People.
- User A likes User B from the full profile.
- User B disappears from User A's active People queue.
- User B sees a non-message profile-like notification.
- User B likes User A; a mutual-like notification appears for both users.
- A single conversation exists for the pair.
- Chats updates with the conversation and unread count behavior remains intact.
- Sending a message updates Chats without creating a Notifications-center message item.
- Passing a profile from People removes it from the queue.
- Undo pass still works for the latest pass where supported.
- Square feed card body opens the post detail page.
- Square comment icon opens the post detail page.
- Square like/comment/repost buttons do not accidentally open the post page.
- Long Square posts are truncated in feed and full on detail page.
- Replies display nested under their parent comments.

## Merge Risks

- Requires the new Supabase migration before preview testing.
- Identity locking changes should be tested with existing users who have missing Date of Birth or Gender.
- Rediscovery behavior changes the visibility of existing liked profiles after migration backfill.
- Notification-center message removal changes tester expectations if they were relying on message notifications instead of Chats.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- Profile image delivery fix verified with `npm.cmd run lint` and `npm.cmd run build`.
