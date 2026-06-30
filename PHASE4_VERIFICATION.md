# Phase 4 Verification

## Scope

This verification reviewed the Phase 4 messaging and notification implementation without modifying application code. Supabase checks were read-only: no conversations, messages, notifications, or read states were inserted, updated, or deleted during this audit.

## Live Supabase Verification

The Phase 4 migration appears to be applied in Supabase. Read-only table checks returned the following counts:

| Table | Status | Count |
| --- | --- | ---: |
| `conversations` | Present | 1 |
| `conversation_members` | Present | 2 |
| `messages` | Present | 2 |
| `message_reads` | Present | 2 |
| `message_reports` | Present | 0 |
| `notifications` | Present | 6 |

Additional read-only checks:

| Check | Result |
| --- | ---: |
| Active conversations | 1 |
| Unread notifications | 6 |
| Read notifications | 0 |
| Message read-status rows | 2 |

## Requirement Verification

| Requirement | Status | Evidence |
| --- | --- | --- |
| Phase 4 migration is applied | Verified | All Phase 4 tables are present in live Supabase and accept read queries with expected columns. |
| Conversations table works | Verified | `conversations` exists, has 1 live row, and is used by `createConversation`, `listConversations`, and `getConversationSummaryById`. |
| Conversation members table works | Verified | `conversation_members` exists, has 2 live rows, and membership is checked before conversation reads/writes. |
| Messages table works | Verified | `messages` exists, has 2 live rows, and `sendConversationMessage` inserts text-only messages with a 1,000 character server guard. |
| Notifications table works | Verified | `notifications` exists, has 6 live rows, and the notification service lists, counts, creates, and marks notifications read by recipient. |
| Messaging unlocks only after mutual save | Verified by code | `createConversation` calls `assertMutualSavePermission`, which requires both `saved_profiles` rows before a conversation can be created. |
| Users cannot message themselves | Verified by code | `createConversation` rejects when the target profile owner is the current signed-in user. |
| Users cannot message blocked users | Verified by code | `assertNotBlocked` runs before conversation creation and again before sending messages. |
| Users can only access conversations they belong to | Verified by code | Message loading, summary loading, sending, marking read, and reporting all check `conversation_members` for the current owned user. |
| New message notification works | Verified by code and live schema | `sendConversationMessage` creates `new_message` notifications for other conversation members; `notifications` table is present and populated. |
| Unread count works | Verified by code and live data | Notification unread count uses an exact Supabase count where `read_at is null`; live Supabase currently has 6 unread notifications. Conversation unread count compares message `created_at` against `message_reads.read_at`. |
| Mark as read works | Verified by code | Conversation read status upserts into `message_reads`; notification read updates only rows where `recipient_user_id` is the current owned user. Live `message_reads` rows exist. |

## Security and Ownership Notes

- All messaging and notification routes use `getCurrentOwnedProfile`, so server logic is based on the Clerk session and the owned Supabase profile.
- Client-submitted user IDs are not trusted for conversation creation. The server accepts a target profile ID and resolves the target user from Supabase.
- Messaging APIs return `404` for non-member conversation access instead of exposing whether a private conversation exists.
- The Phase 4 tables have RLS enabled and grants revoked from `anon` and `authenticated`; application access is expected to go through the server Supabase client.
- Message reporting rejects attempts to report your own message.
- Sending has a basic rate guard of 5 messages per minute per conversation.

## API Coverage Verified

- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/[conversationId]/messages`
- `POST /api/conversations/[conversationId]/messages`
- `POST /api/conversations/[conversationId]/read`
- `POST /api/messages/[messageId]/report`
- `GET /api/notifications`
- `POST /api/notifications/[notificationId]/read`
- `POST /api/notifications/read-all`

## Remaining Manual Browser Tests

These require signed-in browser sessions and at least two users with mutual saves:

1. Sign in as User A and save User B.
2. Sign in as User B and save User A.
3. Confirm the saved profile action opens or creates a conversation.
4. Send a message from User A to User B.
5. Confirm User B sees a new message notification and unread count.
6. Open the conversation as User B and confirm the conversation read state updates.
7. Try messaging after one user blocks the other and confirm sending is denied.
8. Try opening a conversation URL as a user who is not a member and confirm access is denied.

## Known Verification Caveat

This audit did not mutate live Supabase data. The table-level checks are live and read-only; message sending, notification creation, and mark-as-read behavior were verified through the implemented server code paths. Full end-to-end confirmation should be completed in the browser with two mutually saved test users.

## Follow-Up Recommendation

Conversation unread counts currently use the recent message set loaded for inbox summaries. This is acceptable for the current MVP, but before public launch it should be replaced with a dedicated aggregate count query so very old unread messages cannot be undercounted in busy conversations.
