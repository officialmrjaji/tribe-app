# Messaging Performance Report

## Scope

Current Improvement 2 focused on improving responsiveness for `/messages` and `/messages/[conversationId]` without changing the messaging permission model, adding media, adding realtime, or weakening authentication.

## Performance Audit

The previous messaging flow was functional, but it had several responsiveness issues:

- Conversation threads loaded up to 100 messages at once, even when only the latest messages were needed first.
- Sending a message waited for the server response before showing the message in the thread.
- The send response returned only the message, so the conversation summary and inbox state could become stale until a later refetch.
- Inbox unread counts were derived from a limited recent message sample, which could undercount in longer conversations.
- The inbox did not listen for conversation updates after a message was sent from an open thread.
- Loading states existed, but they did not explain whether the app was loading the inbox summary or the latest conversation page.

## Implemented Improvements

- Added paginated message loading with `limit` and `before` query parameters on `GET /api/conversations/[conversationId]/messages`.
- Reduced initial thread load to the latest 30 messages.
- Added a "Load earlier messages" control for older messages.
- Added optimistic message sending so sent text appears immediately while the request is in flight.
- Added delivery states for optimistic messages: sending, sent, and failed.
- Restored failed drafts to the composer and added clearer send failure copy.
- Updated the message send API response to include the refreshed conversation summary.
- Updated the thread locally after sending instead of forcing an inbox refetch.
- Added a browser event and localStorage freshness signal so the inbox can update after a conversation changes.
- Improved inbox loading copy and added a total unread badge.
- Reworked inbox unread count calculation to avoid relying on a small recent-message sample.
- Preserved member-scoped conversation access, server-side Clerk session checks, blocked-user checks, and text-only messages.

## Security Notes

- Conversation access remains scoped through server-side membership checks.
- Message sending still uses the authenticated Clerk session and owned Supabase profile lookup.
- Client-submitted user IDs are not trusted.
- Existing blocked-user protections remain in the server messaging service.
- This change did not add image sharing, voice notes, AI, payments, or realtime subscriptions.

## Known Limits

- Messaging is still request/response based, not realtime.
- Unread count calculation includes a bounded server-side scan guard for safety.
- Pagination uses message `created_at` as the cursor, which is sufficient for the current text-only MVP but may need a compound cursor at larger scale.

## Validation

- `npm run lint` passed.
- `npm run build` passed.

## Files Changed

- `src/app/api/conversations/[conversationId]/messages/route.ts`
- `src/app/messages/[conversationId]/conversation-thread.tsx`
- `src/app/messages/messages-inbox.tsx`
- `src/lib/messaging/service.ts`
- `MESSAGING_PERFORMANCE_REPORT.md`
