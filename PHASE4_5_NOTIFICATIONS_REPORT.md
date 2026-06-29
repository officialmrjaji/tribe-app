# Phase 4.5 Notifications Report

## Summary

Phase 4.5 adds in-app notifications for important discovery and messaging events without push or email delivery. The system is intentionally quiet: notifications are persisted, readable, and badge-counted, but not spammy.

## What Was Implemented

- Added notifications database table.
- Added notification service for creation, listing, unread count, single-read, and read-all actions.
- Added notifications page at `/notifications`.
- Added unread notification badge in navigation.
- Added notification creation for:
  - New message
  - Mutual save
  - Profile saved
  - Conversation created
- Added read/unread status.
- Added mark notification read.
- Added mark all as read.
- Protected notification page and APIs in Clerk middleware.

## API Routes Added

- `GET /api/notifications`
- `POST /api/notifications/[notificationId]/read`
- `POST /api/notifications/read-all`

## Database Objects Added

- `notifications`

## Notification Ownership Model

- Notifications are stored by `recipient_user_id`.
- Reads and read-all updates filter by the current Clerk-owned Supabase user ID.
- Notification listing only returns notifications for the signed-in user.
- Actor profiles are resolved server-side for display names.

## Event Sources

- Saving a profile creates a `profile_saved` notification for the profile owner.
- Reciprocal saves create `mutual_save` notifications for both users.
- Creating a conversation creates a `conversation_created` notification for the recipient.
- Sending a message creates a `new_message` notification for other conversation members.

## Files Changed

- `supabase/migrations/20260629000000_phase4_messaging_notifications.sql`
- `src/lib/notifications/service.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/[notificationId]/read/route.ts`
- `src/app/api/notifications/read-all/route.ts`
- `src/app/notifications/page.tsx`
- `src/app/notifications/notifications-page.tsx`
- `src/components/notifications/notification-badge.tsx`
- `src/lib/discovery/service.ts`
- `src/lib/messaging/service.ts`
- `src/app/page.tsx`
- `src/components/discovery/profile-collection-page.tsx`
- `src/proxy.ts`

## Validation

- `npm run lint` passed.
- `npm run build` passed.

## Known Limitations

- Push notifications are not implemented.
- Email notifications are not implemented.
- The badge fetches the unread count on page load and does not update in realtime.
- Notification dedupe is used for profile saves, mutual saves, and conversation creation; new messages intentionally create separate notifications.

## Testing Notes

- Apply `supabase/migrations/20260629000000_phase4_messaging_notifications.sql` manually in the Supabase SQL Editor before testing.
- Profile-save and mutual-save notifications require at least two real users.
- Messaging notifications require a conversation created from two users who have mutually saved each other.
