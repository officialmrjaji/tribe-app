# Trial UX Refinement Report

## Summary

Implemented a focused private-beta refinement branch for profile preview, cleaner People cards, compact Square feed structure, Square media viewing, notification deep links, and mutual-like chat creation.

This work is on `trial/ux-profile-people-square-notifications` and is based on the committed Trial Improvements branch snapshot.

## Implemented Work

- Added a public-safe profile preview at `/profile/preview`.
- Updated legacy `/profile` to redirect to the profile preview.
- Replaced the bespoke public member page with a shared public profile renderer.
- Added Preview profile actions in Me, Profile Edit, and Settings.
- Removed profile completion from public profile presentation.
- Simplified People cards by moving detailed interests, goals, languages, and traits into the full profile page.
- Kept compact People cards focused on photo, name, age, location, personality signal, activity/verification badges, and concise reasons.
- Updated Square feed cards so full comment threads no longer expand in the main feed.
- Kept full threaded comments, reply composer, edit/delete/report actions, and comment liking on `/square/posts/[postId]`.
- Added Square image full-screen viewing through the shared gallery pattern.
- Added keyboard support to the full-screen gallery: Escape closes, arrow keys navigate.
- Added automatic conversation creation when two users mutually like each other.
- Added notification support for Square comments, replies, mentions, post likes, and reposts.
- Improved notification labels and deep links.
- Marked notifications read when users open the linked activity.

## Files Changed

- `src/app/me/page.tsx`
- `src/app/notifications/notifications-page.tsx`
- `src/app/page.tsx`
- `src/app/profile/edit/profile-editor.tsx`
- `src/app/profile/page.tsx`
- `src/app/profile/preview/page.tsx`
- `src/app/profiles/[profileId]/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/profile/profile-photo-gallery.tsx`
- `src/components/profile/public-profile-view.tsx`
- `src/components/square/square-post-card.tsx`
- `src/lib/discovery/service.ts`
- `src/lib/notifications/service.ts`
- `src/lib/profile/public-profile.ts`
- `src/lib/square/service.ts`
- `supabase/migrations/20260710000000_trial_ux_refinement.sql`
- `TRIAL_UX_REFINEMENT_REPORT.md`

## Migrations Created

- `supabase/migrations/20260710000000_trial_ux_refinement.sql`

This migration expands the `notifications` type and entity constraints to support Square activity:

- `square_comment`
- `square_reply`
- `square_mention`
- `square_like`
- `square_repost`
- `square_post`
- `square_comment`

It also adds an index for recipient/type notification queries.

Apply this migration to the preview Supabase database before testing Square activity notifications.

## Shared Components Introduced

- `PublicProfileView`
  - Shared renderer for public member profiles and self-preview.
  - Shows only public-safe profile fields.
  - Supports ordered photos, bio, prompts, interests, goals, personality, lifestyle, languages, voice intro, verification, and activity state.

- `getPublicMemberProfile`
  - Server-side public-safe profile fetcher.
  - Enforces private-profile and block relationship checks.
  - Avoids exposing email, account ids beyond existing route ids, completion score, admin state, moderation state, or hidden fields.

## Realtime Changes

- No new browser Supabase table subscriptions were added.
- Existing ownership-safe SSE invalidation remains the realtime layer.
- Mutual-like conversation creation writes server-side rows that trigger the existing `messages` invalidation path.
- Square comment/like/repost changes trigger the existing `square` invalidation path.
- Square notifications trigger the existing `notifications` invalidation path.
- No row payloads or private content are sent through the realtime stream.

## Privacy And Security Notes

- Profile preview uses the same public-safe renderer as member profile viewing.
- Private profiles return not found for other users.
- Blocked relationships cannot view each other through public profile pages.
- Square anonymous posts still preserve anonymous author presentation.
- Mention resolution excludes private profiles and blocked/muted users.
- Users can only edit or delete their own Square posts/comments through existing server checks.
- Mutual-like conversations are created with the existing messaging service, which keeps mutual-like, block, self-message, and photo-quality checks.
- Payment and AI feature gates remain untouched.
- Private beta invite-code access remains untouched.

## Mobile And Accessibility Changes

- People cards have less dense content and larger primary images.
- Icon-only Square feed actions keep screen-reader labels.
- Square comment links open the dedicated thread page on mobile and desktop.
- The full-screen gallery supports keyboard close/navigation and touch swipe.
- Profile preview uses responsive single-column/mobile and split desktop layouts.

## Known Limitations

- Square storage currently supports one image per post in the database. The gallery is reusable and supports multiple images, but this branch does not introduce a multi-image Square schema.
- Push notifications and email notifications remain out of scope.
- Realtime is still invalidation-based rather than row-stream based for safety.
- Notification grouping is label-based rather than collapsed grouped sections.

## Deferred Recommendations

- Add multi-image Square media tables later if product testing proves photo-heavy Square posts are important.
- Add conversation-open CTA directly in the People success notice when a mutual like happens.
- Add richer notification grouping once activity volume is higher.
- Add automated browser smoke tests for the two-user mutual-like flow.

## Two-User Manual Test Checklist

1. Apply `20260709000000_trial_improvements.sql` if it is not already applied.
2. Apply `20260710000000_trial_ux_refinement.sql`.
3. Sign in as User A and User B with valid private beta access.
4. Confirm both users have onboarding completed and at least three real profile photos.
5. User A opens `/profile/preview` and confirms only public-safe fields are visible.
6. User A opens `/profile/edit`, changes a prompt/photo, then opens Preview profile.
7. User A opens People and confirms compact cards show essential info only.
8. User A opens a profile with View Profile and confirms full details are on the full profile page.
9. User A likes User B.
10. User B likes User A.
11. Confirm one conversation is created and appears in Chats for both users.
12. Confirm mutual-like notification deep-links to the conversation.
13. Send a message from User A and confirm it appears for User B without a manual refresh.
14. Confirm inbox previews and unread counts update.
15. Create a Square post with an image.
16. Confirm the main Square feed does not render the full comment thread inline.
17. Click the Square image and confirm full-screen gallery open/close/navigation works.
18. Click the comment icon and confirm it opens `/square/posts/[postId]`.
19. Add a comment, a reply, a mention, a like, and a repost from the other user.
20. Confirm notification labels and deep links work for Comment, Reply, Mention, and Square activity.
21. Confirm anonymous posts do not expose the author.
22. Confirm blocked users cannot interact or view each other through profile/Square flows.

## Merge Risks

- The notification migration must be applied before Square notification writes are exercised.
- The parent Trial Improvements migration is also required because this branch builds on its realtime and profile-photo-management work.
- This branch should be tested through a Vercel preview with two accounts before merging.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
