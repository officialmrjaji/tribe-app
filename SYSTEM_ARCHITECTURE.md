# System Architecture

## Purpose

This document defines the production architecture direction for TribeApp as it moves from MVP development into production engineering.

TribeApp currently includes authentication, profiles, onboarding, discovery, matching, save/pass, messaging, notifications, profile quality, trust polish, Square community, Premium, AI Companion, and Voice Experience. The next architecture goal is to make these systems reliable, observable, secure, and scalable without losing the calm, personality-first product philosophy.

## High-Level Architecture

TribeApp is a Next.js application backed by Clerk, Supabase, Paystack, and OpenAI.

Core systems:

- Clerk handles identity, sessions, email login, Google login, and verified contact signals.
- Next.js App Router serves pages and API route handlers.
- Supabase Postgres stores application data.
- Supabase Storage stores profile media and Square media.
- Paystack handles premium and boost payments.
- OpenAI supports optional profile, match, conversation, and safety assistance.
- Server-side service modules enforce ownership, permissions, matching rules, premium gates, and moderation rules.

System flow:

```text
User
  -> Next.js pages and client components
  -> Clerk session
  -> Next.js API route handlers
  -> Domain services
  -> Supabase Postgres / Supabase Storage
  -> External providers where needed
       -> Paystack for billing
       -> OpenAI for AI assistance
       -> Future realtime/voice provider for live audio
```

Domain connections:

```text
Authentication
  -> Users
  -> Profiles
  -> Ownership checks
  -> Protected API routes

Profiles
  -> Onboarding
  -> Profile quality
  -> Discovery eligibility
  -> Matching inputs
  -> Messaging identity
  -> Square author identity
  -> Voice identity
  -> Premium badges and boosts

Discovery
  -> Profiles
  -> Onboarding answers
  -> Profile photos
  -> Save/pass history
  -> Blocks/reports
  -> Premium limits and boosts

Matching
  -> Recommendations
  -> Saved profiles
  -> Passed profiles
  -> Match explanations
  -> Messaging permission
  -> Notifications

Messaging
  -> Mutual save permission
  -> Conversations
  -> Messages
  -> Message reads
  -> Notifications
  -> Blocks/reports

Notifications
  -> Saves
  -> Matches
  -> Conversations
  -> Messages
  -> Premium status events
  -> Square mentions and engagement

Square
  -> Profiles
  -> Posts
  -> Comments
  -> Likes
  -> Reposts
  -> Mentions
  -> Topics
  -> Polls
  -> Moderation

Voice
  -> Profiles
  -> Onboarding answers
  -> Voice intros
  -> Random voice sessions
  -> Voice rooms
  -> Reveal-after-session flow
  -> Safety reports

Premium
  -> Paystack payments
  -> Subscriptions
  -> Boosts
  -> Usage counters
  -> Feature gates
  -> Premium badges

AI
  -> OpenAI
  -> Profile coaching
  -> Match coaching
  -> Conversation coaching
  -> Safety checks
  -> Moderation support

Admin
  -> User lookup
  -> Reports
  -> Moderation queues
  -> Billing support
  -> Feature flags
  -> Operational dashboards

Analytics
  -> Product events
  -> Funnel metrics
  -> Retention metrics
  -> Trust and safety metrics
  -> Revenue metrics
```

## Backend Architecture

### API Structure

The backend currently uses Next.js route handlers under `src/app/api`.

Recommended production route groups:

- `/api/me`: current user and session context.
- `/api/profile`: profile ownership, profile editing, photos, prompts, voice intro.
- `/api/onboarding`: onboarding answers and completion.
- `/api/discover`: database-backed recommendations and eligibility gates.
- `/api/profile/save`, `/api/profile/pass`, `/api/profile/block`, `/api/profile/report`: discovery actions.
- `/api/conversations`: conversation list and creation.
- `/api/conversations/[conversationId]/messages`: message read/write.
- `/api/notifications`: notification list, counts, read state.
- `/api/square`: feed, posts, comments, likes, reposts, topics, polls, reports.
- `/api/premium`: checkout, verify, status, restore, webhook.
- `/api/ai`: profile coach, match coach, conversation coach, safety check.
- `/api/voice`: voice matching, sessions, rooms, reveal.
- Future `/api/admin`: admin-only moderation and operations.
- Future `/api/analytics`: event ingestion if not using a third-party SDK.

Route handlers should stay thin. They should:

- Authenticate with Clerk.
- Resolve the owned Supabase user/profile.
- Validate input with Zod.
- Call a domain service.
- Return consistent JSON responses.
- Avoid direct table access in client components.

### Services

Service modules should remain the main backend boundary.

Current service families:

- `auth`: owned profile lookup and session-to-user mapping.
- `profile`: profile updates, media, completeness.
- `onboarding`: onboarding completion and answers.
- `discovery`: recommendation generation, save/pass/block/report.
- `messaging`: conversation permission, message access, read state.
- `notifications`: notification creation, unread counts, read state.
- `square`: feed, posts, engagement, topics, moderation.
- `premium`: Paystack checkout, subscription status, boost lifecycle, usage counters.
- `ai`: OpenAI calls, prompt handling, safety checks.
- `voice`: random voice sessions, rooms, reveal logic.

Recommended service rules:

- Services should not trust client-submitted user IDs.
- Services should always receive the authenticated current user context.
- Services should own all cross-table permission checks.
- Services should centralize repeated filters such as blocked users, hidden users, discoverability, and profile completeness.
- Services should emit events for analytics, notifications, moderation, and future background jobs.

### Database Boundaries

Supabase Postgres is the system of record.

Recommended boundaries:

- Identity boundary: `users`, `profiles`, verification fields, ownership audit.
- Profile boundary: profile preferences, interests, photos, prompts, voice intro.
- Onboarding boundary: onboarding answers and personality signals.
- Discovery boundary: recommendations, saved profiles, passed profiles, blocked users, reports.
- Messaging boundary: conversations, conversation members, messages, reads, message reports.
- Notification boundary: notifications and read state.
- Square boundary: posts, comments, likes, reposts, mentions, topics, polls, reports, mutes.
- Premium boundary: plans, purchases, subscriptions, boosts, usage counters.
- AI boundary: suggestions and safety checks.
- Voice boundary: voice sessions, session participants, voice rooms, room participants.
- Future admin boundary: admin users, audit logs, moderation decisions, support notes.
- Future analytics boundary: event log, daily aggregates, funnel snapshots.

### Storage Buckets

Current buckets:

- `profile-media`: profile photos and voice introductions.
- `square-media`: Square post media.

Recommended future buckets:

- `voice-room-recordings`: only if recording is explicitly introduced with consent.
- `moderation-evidence`: server-only evidence snapshots for reports.
- `admin-exports`: private operational exports with short-lived signed URLs.
- `video-media`: future video, separated from image and voice workloads.

Bucket rules:

- Use owner-scoped storage paths.
- Store metadata rows in Postgres for ownership and moderation.
- Prefer signed URLs for private media.
- Keep public media limited to intentionally public profile and Square assets.
- Never rely only on Storage path names for authorization.

### Background Jobs

The MVP uses mostly request-time writes. Production should introduce background workers for:

- Notification fanout.
- Recommendation refreshes.
- Premium expiry and boost expiry.
- Usage counter resets.
- AI safety checks for queued content.
- Moderation queue triage.
- Trending topic aggregation.
- Square feed ranking snapshots.
- Voice session expiry cleanup.
- Email or push notifications if introduced later.
- Analytics aggregation.

Initial options:

- Supabase scheduled functions.
- Vercel cron jobs.
- A worker process using a managed queue.
- Postgres-backed job table for early scale.

Future options:

- Upstash Redis queues.
- BullMQ with Redis.
- Cloud Tasks or SQS if infrastructure moves beyond Vercel/Supabase.

### Event-Driven Flows

TribeApp should move toward an event-driven internal model.

Recommended event examples:

- `user.signed_up`
- `profile.updated`
- `profile.completed`
- `profile.photo_uploaded`
- `onboarding.completed`
- `discovery.recommendation_viewed`
- `profile.saved`
- `profile.passed`
- `profile.blocked`
- `match.created`
- `conversation.created`
- `message.sent`
- `message.read`
- `notification.created`
- `square.post_created`
- `square.comment_created`
- `square.post_reported`
- `premium.purchase_started`
- `premium.purchase_verified`
- `premium.subscription_activated`
- `boost.activated`
- `ai.suggestion_created`
- `ai.safety_flagged`
- `voice.session_started`
- `voice.session_revealed`
- `voice.room_created`

Near-term implementation:

- Add a server-side `events` table.
- Write events transactionally inside services.
- Add a scheduled worker to process pending events.

Long-term implementation:

- Add a durable queue.
- Split analytics, notifications, and moderation consumers.
- Make event processing idempotent.

## Database Architecture

### Current Schema

Current schema families:

- Core identity: `users`, `profiles`, `profile_ownership_audit`.
- Preferences and interests: `profile_preferences`, `interests`, `user_interests`.
- Onboarding: `onboarding_answers`.
- Profile quality: `profile_photos`, `profile_prompts`, profile completion and verification columns.
- Discovery and matching: `recommendations`, `saved_profiles`, `passed_profiles`, `blocked_users`, `reports`.
- Messaging: `conversations`, `conversation_members`, `messages`, `message_reads`, `message_reports`.
- Notifications: `notifications`.
- Square: `square_posts`, `square_comments`, `square_likes`, `square_reposts`, `square_mentions`, `square_topics`, `square_post_topics`, `square_polls`, `square_poll_options`, `square_poll_votes`, `square_reports`, `square_mutes`.
- Premium: `premium_plans`, `premium_purchases`, `premium_subscriptions`, `profile_boosts`, `premium_usage_counters`.
- AI: `ai_suggestions`, `ai_safety_checks`.
- Voice: `voice_sessions`, `voice_session_participants`, `voice_rooms`, `voice_room_participants`.

### Future Schema

Recommended future tables:

- `events`: durable product and system events.
- `analytics_daily_user_metrics`: daily per-user aggregates.
- `analytics_funnels`: funnel snapshots.
- `admin_users`: admin roles and permissions.
- `admin_audit_logs`: immutable admin actions.
- `moderation_cases`: unified reports across profiles, messages, Square, voice.
- `moderation_actions`: warnings, removals, suspensions, appeals.
- `device_sessions`: device-level session metadata for security.
- `rate_limit_events`: abuse and rate limit audit trail.
- `feature_flags`: rollout control.
- `search_documents`: denormalized search index source.
- `recommendation_batches`: generated recommendation snapshots.
- `notification_preferences`: per-channel notification control.
- `push_tokens`: if push notifications are added.

### Scaling Strategy

At MVP scale, request-time queries are acceptable. Production should gradually introduce:

- Denormalized read models for heavy feeds and inboxes.
- Background recommendation batches.
- Cached profile summaries.
- Cached notification counts.
- Event-based analytics aggregation.
- Cursor pagination everywhere.
- Query-specific indexes based on real `EXPLAIN ANALYZE` output.

### Index Strategy

Current migrations include useful indexes for ownership, feed access, message ordering, notification counts, premium status, Square feed, and voice state.

Production index priorities:

- `profiles`: discoverability, completion, visibility, city, active time, boosted state.
- `recommendations`: viewer, score, generation time.
- `saved_profiles`: viewer and saved user lookups.
- `passed_profiles`: viewer and expiry.
- `blocked_users`: both blocker and blocked lookups.
- `messages`: conversation and created time.
- `notifications`: recipient unread and recipient created time.
- `square_posts`: feed status, visibility, created time, score.
- `square_comments`: post and created time.
- `premium_subscriptions`: active status by user and profile.
- `profile_boosts`: active boosts by profile and end time.
- `voice_sessions`: status, end time, participants.
- `voice_rooms`: status, type, scheduled time.

Use partial indexes for common active-state filters:

- Unread notifications.
- Active subscriptions.
- Active boosts.
- Active public Square posts.
- Open moderation cases.
- Non-deleted messages.

### Partitioning Opportunities

Partition only after metrics justify it.

Likely future candidates:

- `messages`: by month or conversation hash at high volume.
- `notifications`: by month.
- `events`: by month.
- `square_posts`: by month if feed volume grows.
- `square_comments`: by month or post hash.
- `ai_safety_checks`: by month.
- `voice_sessions`: by month.

Do not partition small relational tables such as profiles, profile photos, plans, or interests too early.

## Media Architecture

### Photos

Profile photos should remain in `profile-media` with metadata in `profile_photos`.

Production requirements:

- Validate MIME type and size server-side.
- Enforce per-user ownership.
- Generate normalized variants later: thumbnail, card, full.
- Store dimensions, blurhash, and moderation status in the metadata row.
- Queue image moderation before public discovery at larger scale.

### Voice

Voice intros currently use `profile-media` and profile metadata fields.

Voice sessions and rooms currently provide product and state foundations but should use a dedicated realtime audio provider for actual live audio at production quality.

Future requirements:

- Explicit consent for any recording.
- No recording by default.
- Ephemeral room/session tokens.
- Separate provider credentials from Supabase keys.
- Abuse controls for repeated room disruption.

### Square Media

Square media should remain separate in `square-media`.

Recommended metadata additions:

- `square_post_media`
- `media_type`
- `storage_path`
- `public_url`
- `width`
- `height`
- `duration_seconds`
- `moderation_status`
- `sort_order`

### Future Video

Video should not be added to current buckets casually.

Future video architecture should include:

- Dedicated `video-media` bucket.
- Transcoding pipeline.
- Thumbnail generation.
- Duration and size limits.
- Abuse detection.
- Signed playback URLs for private contexts.
- CDN strategy.
- Strict consent rules for voice/video rooms.

## AI Architecture

### OpenAI Integration

OpenAI should remain server-only through `OPENAI_API_KEY`.

AI calls should go through a single service layer that handles:

- Model selection.
- Prompt templates.
- Input validation.
- Output validation.
- Safety checks.
- Rate limits.
- Logging without storing unnecessary sensitive input.
- Optional persistence in `ai_suggestions` and `ai_safety_checks`.

### Prompt Handling

Prompt templates should be versioned.

Recommended future structure:

- `src/lib/ai/prompts/profile-coach.ts`
- `src/lib/ai/prompts/match-coach.ts`
- `src/lib/ai/prompts/conversation-coach.ts`
- `src/lib/ai/prompts/safety.ts`

Persist:

- `prompt_version`
- `feature`
- `input_summary`
- `output`
- `accepted_at`
- `dismissed_at`
- `edited_output`

Do not persist full private message content unless required for moderation and disclosed in policy.

### Safety Layer

AI safety checks should support:

- Spam detection.
- Harassment detection.
- Scam detection.
- Sexual or threatening content risk.
- Repeated abuse patterns.
- Escalation to human review.

AI should assist moderation, not be the final authority for serious enforcement.

### Future AI Expansion

Future AI features:

- Profile quality coach.
- Better match explanations.
- Optional conversation suggestions.
- Square moderation triage.
- Scam pattern detection.
- Support assistant for help center.
- Embedding-based recommendation experiments.

Guardrails:

- Never send secrets to AI.
- Do not impersonate users.
- Do not silently rewrite messages.
- Keep AI optional for user-facing creative features.

## Premium Architecture

### Subscription Lifecycle

Subscription lifecycle:

```text
User selects plan
  -> Paystack checkout initialized
  -> purchase row created as pending
  -> Paystack payment completed
  -> verification route or webhook verifies transaction
  -> purchase marked paid
  -> subscription activated
  -> premium status available to feature gates
  -> expiry or renewal updates status
```

Server rules:

- Never trust client payment status.
- Verify all transactions with Paystack server-side.
- Make webhook handling idempotent.
- Store provider reference IDs.
- Reconcile subscription state on restore.

### Boost Lifecycle

Boost lifecycle:

```text
User buys boost
  -> payment verified
  -> profile_boost row created
  -> profile receives boosted discovery priority
  -> boost expires after duration
  -> scheduled job deactivates or query filters by end time
```

Boosts should improve exposure without making free users invisible.

### Usage Counters

Usage counters should track:

- Daily recommendations viewed.
- Daily saves.
- Undo pass usage.
- Premium feature usage.
- Boost impressions.

Counters should reset by period and be enforced server-side.

Recommended future improvements:

- Move counter increments into transactions.
- Add idempotency keys for actions.
- Cache remaining limits for UI display.
- Add abuse detection for rapid actions.

### Future Billing Providers

Paystack is the current provider. Future providers can include:

- Flutterwave.
- Stripe.
- Apple App Store subscriptions.
- Google Play Billing.

Billing provider abstraction should include:

- Plan mapping.
- Checkout creation.
- Transaction verification.
- Webhook verification.
- Refunds and chargebacks.
- Subscription status sync.

## Analytics Architecture

### Event Tracking

Track events server-side for trustworthy product metrics. Client-side events can supplement UI behavior but should not be the only source for core business actions.

Important events:

- Signup completed.
- Onboarding started/completed.
- Profile completion score changed.
- Photo uploaded.
- Voice intro uploaded.
- Discovery viewed.
- Recommendation viewed.
- Profile saved.
- Profile passed.
- Mutual save created.
- Conversation created.
- Message sent.
- Notification read.
- Square post created.
- Square comment created.
- Premium checkout started.
- Premium activated.
- Boost activated.
- AI suggestion generated.
- Voice session started.
- Voice room joined.
- Report created.
- Block created.

### User Analytics

Track:

- Activation status.
- Profile completeness.
- Discovery eligibility.
- Recommendation views.
- Save/pass ratio.
- Match rate.
- Message response rate.
- Square participation.
- Premium status.
- Trust and safety events.

### Product Analytics

Track:

- Onboarding conversion.
- Profile completion conversion.
- Discovery unlock rate.
- Recommendation quality.
- Save rate.
- Mutual save rate.
- Messaging activation.
- Square feed creation and engagement.
- Voice session creation and completion.
- Premium conversion.
- Churn risk signals.

### Funnel Analytics

Core funnel:

```text
Signup
  -> Onboarding complete
  -> Profile 80% complete
  -> 3 photos uploaded
  -> Discovery unlocked
  -> Save sent
  -> Mutual save
  -> Conversation created
  -> Message exchanged
  -> Return within 7 days
```

Premium funnel:

```text
Premium page viewed
  -> Plan selected
  -> Checkout started
  -> Payment verified
  -> Subscription activated
  -> Premium feature used
  -> Renewal / repeat purchase
```

### Retention Metrics

Track:

- Day 1 retention.
- Day 7 retention.
- Day 30 retention.
- Retention after first save.
- Retention after first mutual save.
- Retention after first message.
- Retention after Square participation.
- Retention after voice session.
- Retention by profile quality tier.

## Security Architecture

### Authentication

Clerk is the identity provider.

Security requirements:

- Clerk middleware protects app and authenticated API routes.
- Internal Clerk routes and static assets remain excluded.
- Server APIs use Clerk session user ID.
- Clerk verified email and phone signals should be mapped server-side only.

### Authorization

Authorization must be domain-specific:

- Users can edit only their own profile.
- Users can read only conversations they belong to.
- Users can message only permitted users.
- Users cannot message blocked users.
- Users cannot save, pass, report, or block themselves.
- Users cannot assign premium or verification status from the client.
- Square anonymous posts must still preserve server-side author identity.
- Voice rooms and sessions must check participant membership.

### Ownership

Ownership model:

- Clerk user ID maps to `users.clerk_user_id`.
- `profiles.user_id` and `profiles.clerk_user_id` link owned profile data.
- Services resolve the current user/profile from the session.
- Client-submitted owner IDs are ignored or validated against the session.

### Rate Limiting

Near-term rate limits:

- Profile save/pass actions.
- Message sending.
- Square posting and commenting.
- AI calls.
- Premium checkout creation.
- Reports.
- Voice match attempts.
- Room creation.

Implementation options:

- In-memory for local only.
- Supabase table counters for early production.
- Redis-backed rate limiting for scale.

### Spam Prevention

Spam prevention should combine:

- Profile quality gates.
- Message length and frequency limits.
- Square posting limits.
- Report/block monitoring.
- AI safety checks.
- Device/session anomaly detection.
- Delayed feature access for new risky accounts if needed.

### Moderation

Moderation should unify reports across:

- Profiles.
- Messages.
- Square posts.
- Square comments.
- Voice sessions.
- Voice rooms.
- AI-flagged content.

Future admin tooling should support:

- Queue triage.
- Evidence review.
- User history.
- Warnings.
- Content removal.
- Temporary restrictions.
- Account suspension.
- Appeals.
- Admin audit logging.

## Deployment Architecture

### Local

Local environment:

- Next.js dev server.
- Clerk development keys.
- Supabase project or local Supabase.
- Paystack test keys.
- OpenAI development key.
- Manual SQL migration application when needed.

Local goals:

- Fast iteration.
- Safe test keys.
- Clear `.env.example`.
- Seed data for two or more completed users.

### Staging

Staging should mirror production.

Requirements:

- Separate Clerk app.
- Separate Supabase project.
- Separate Paystack test environment.
- Separate OpenAI key with lower quota.
- Production-like environment variables.
- Automated migrations.
- Smoke tests after deploy.
- Test admin account.
- Test user accounts for each major flow.

### Production

Production requirements:

- Managed hosting for Next.js.
- Production Clerk app.
- Production Supabase project.
- Production Paystack keys.
- Strict environment variable management.
- Automated database backups.
- Error monitoring.
- Request logging.
- Uptime monitoring.
- Webhook monitoring.
- Admin access controls.
- Incident runbooks.

## Scaling Roadmap

### 100 Users

Focus:

- Correctness.
- Manual support.
- Stable migrations.
- Basic analytics.
- Manual moderation.

Actions:

- Verify all core flows.
- Add smoke test checklist.
- Use Supabase dashboard for operations.
- Track activation and retention manually.

### 1,000 Users

Focus:

- Observability.
- Rate limits.
- Better admin tools.
- Query tuning.

Actions:

- Add structured logging.
- Add error monitoring.
- Add event tracking table.
- Add admin report queue.
- Add basic rate limits.
- Add indexes based on slow queries.

### 10,000 Users

Focus:

- Background jobs.
- Analytics aggregation.
- Feed and recommendation efficiency.
- Support workflows.

Actions:

- Add queue or scheduled workers.
- Precompute recommendations.
- Aggregate notification counts.
- Add moderation case system.
- Add product dashboards.
- Add cache for premium status and profile summaries.

### 100,000 Users

Focus:

- Read models.
- Search.
- Partitioning.
- Team operations.

Actions:

- Add dedicated search service.
- Add denormalized feed tables.
- Partition high-volume event/message tables.
- Add Redis for counters and rate limits.
- Add admin roles and audit logs.
- Add webhook retry infrastructure.

### 1 Million Users

Focus:

- Service separation.
- Advanced moderation.
- Multi-region strategy.
- Data lifecycle management.

Actions:

- Split heavy workloads into workers.
- Move realtime voice to specialized provider.
- Use CDN and media processing pipelines.
- Archive old events and notifications.
- Scale analytics warehouse outside primary Postgres.
- Add automated abuse detection.
- Formalize security reviews and compliance processes.

