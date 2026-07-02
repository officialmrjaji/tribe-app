# Like, Explore, and Premium Visibility Report

## Summary

Updated profile interaction language from Save/Saved to Like/Liked while keeping the existing `saved_profiles` database model for safety and backwards compatibility.

## Implemented

- Replaced user-facing Save/Saved profile language with Like/Liked.
- Added `/api/profile/like` as a safe alias over the existing profile-save action.
- Preserved `/api/profile/save` and `saved_profiles` so existing data and integrations continue to work.
- Added visible View actions on discovery cards, discovery detail panel, and collection cards.
- Added `/explore` as the unified hub for:
  - People I liked
  - People I passed
  - Who liked me
  - Matches
- Converted `/saved` to redirect to `/explore?tab=liked`.
- Converted `/passed` to redirect to `/explore?tab=passed`.
- Added Premium gating for Who liked me.
- Added a locked Who liked me preview/upsell for free users.
- Added matches based on mutual likes.
- Kept basic liking and mutual matching available to free users.
- Updated notification, messaging, settings, Premium, and admin copy to use like/mutual-like language.

## Privacy And Safety

- Existing database table names remain unchanged to avoid migration risk.
- Profile views use the existing `/profiles/[profileId]` route.
- Private profiles remain hidden.
- Blocked relationships are hidden from Explore collections.
- Who liked me uses the same privacy/block-filtered collection logic for both Premium views and free preview counts.

## Files Changed

- `LIKE_EXPLORE_PREMIUM_REPORT.md`
- `src/app/admin/page.tsx`
- `src/app/api/profile/like/route.ts`
- `src/app/api/profile/save/route.ts`
- `src/app/explore/page.tsx`
- `src/app/messages/[conversationId]/conversation-thread.tsx`
- `src/app/messages/messages-inbox.tsx`
- `src/app/notifications/notifications-page.tsx`
- `src/app/page.tsx`
- `src/app/passed/page.tsx`
- `src/app/premium/upgrade-client.tsx`
- `src/app/profile/edit/profile-editor.tsx`
- `src/app/profiles/[profileId]/page.tsx`
- `src/app/saved/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/discovery/profile-collection-grid.tsx`
- `src/components/discovery/profile-collection-page.tsx`
- `src/lib/discovery/service.ts`
- `src/lib/messaging/service.ts`
- `src/lib/notifications/service.ts`
- `src/lib/premium/service.ts`
- `src/proxy.ts`

## Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

## Notes

The internal `saved_profiles`, `profile_saved`, and `mutual_save` names still exist. They now represent profile likes at the product layer and can be renamed in a later database migration if a full compatibility plan is created.
