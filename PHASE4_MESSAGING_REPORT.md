# Phase 4 Messaging Report

## Summary

Phase 4 adds permission-based, text-only messaging for users who have mutually saved each other. The implementation keeps all conversation access server-owned through the Clerk session and Supabase user/profile lookup.

## What Was Implemented

- Added conversation, conversation member, message, read status, and message report database tables.
- Added server-side messaging service for creating conversations, listing inbox items, loading conversation threads, sending messages, marking conversations read, and reporting messages.
- Added inbox page at `/messages`.
- Added conversation page at `/messages/[conversationId]`.
- Added text-only message composer, message list, loading state, empty state, and error state.
- Added block/report actions from the conversation page.
- Added a saved-profile "Message" action that opens a conversation only when the server confirms permission.
- Protected messaging pages and APIs in Clerk middleware.

## Messaging Permission Model

- Users can only start a conversation when both users have saved each other in `saved_profiles`.
- Users cannot message themselves.
- Users cannot message blocked users.
- Conversation reads, writes, and message reports are scoped to conversation membership.
- Client-submitted user IDs are not trusted. Conversation creation accepts a target profile ID, then resolves the owner from Supabase on the server.

## API Routes Added

- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/[conversationId]/messages`
- `POST /api/conversations/[conversationId]/messages`
- `POST /api/conversations/[conversationId]/read`
- `POST /api/messages/[messageId]/report`

## Database Objects Added

- `conversations`
- `conversation_members`
- `messages`
- `message_reads`
- `message_reports`

## Security Notes

- All new messaging tables have RLS enabled and public/authenticated grants revoked.
- Application access goes through the server Supabase client.
- Conversation membership is checked before reading, sending, marking read, or reporting.
- Sending has a basic rate guard of 5 messages per minute per conversation.
- Block checks run before conversation creation and before sending.

## Files Changed

- `supabase/migrations/20260629000000_phase4_messaging_notifications.sql`
- `src/lib/messaging/schema.ts`
- `src/lib/messaging/service.ts`
- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/[conversationId]/messages/route.ts`
- `src/app/api/conversations/[conversationId]/read/route.ts`
- `src/app/api/messages/[messageId]/report/route.ts`
- `src/app/messages/page.tsx`
- `src/app/messages/messages-inbox.tsx`
- `src/app/messages/[conversationId]/page.tsx`
- `src/app/messages/[conversationId]/conversation-thread.tsx`
- `src/components/discovery/profile-collection-grid.tsx`
- `src/components/discovery/profile-collection-page.tsx`
- `src/app/saved/page.tsx`
- `src/app/page.tsx`
- `src/proxy.ts`

## Validation

- `npm run lint` passed.
- `npm run build` passed.

## Known Limitations

- Messaging is not realtime yet.
- Messages are text-only.
- Image sharing, voice notes, push notifications, and email notifications are not implemented.
- Conversation creation currently supports mutual-save permission only, with the schema ready for future permission sources.

## Testing Notes

- Apply `supabase/migrations/20260629000000_phase4_messaging_notifications.sql` manually in the Supabase SQL Editor before testing.
- You need at least two users who have mutually saved each other before messaging can be tested properly.
