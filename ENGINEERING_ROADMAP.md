# Engineering Roadmap

## Current State Assessment

TribeApp has moved beyond a prototype and now contains the major MVP and post-MVP product surfaces:

- Authentication through Clerk.
- Supabase-backed user profiles and ownership.
- Personality onboarding.
- Discovery and recommendation logic.
- Save, pass, restore, block, and report flows.
- Messaging and notifications.
- Profile quality gates and media uploads.
- Trust and polish surfaces.
- Square community feed.
- Premium plans, boosts, and Paystack integration.
- AI Companion using OpenAI.
- Voice matching, voice rooms, and voice profile improvements.

The application is still architected as a monolithic Next.js app with API route handlers, service modules, Supabase Postgres, Supabase Storage, and external providers. This is the right shape for the current stage, but production engineering should now prioritize reliability, observability, operational safety, testing, and scalability.

## Technical Debt

Known or likely technical debt:

- Migrations are applied manually and need a formal staging/production workflow.
- RLS is enabled and direct grants are revoked, but app access relies heavily on server-side service-key operations.
- There is no unified event tracking system.
- Background jobs are not yet formalized.
- Admin tooling is minimal or missing.
- Analytics are not yet a first-class backend system.
- Recommendation logic is still request-time and should become batchable.
- Square feed ranking and trending logic need scalable aggregation.
- Messaging is not realtime and may need transport decisions.
- Voice experience has product/session foundations but needs a realtime audio provider for production live audio.
- Rate limiting should be centralized.
- Error response formats should be standardized across all APIs.
- Tests need to cover ownership, abuse, payment, AI, and moderation flows.
- Observability needs structured logs, error monitoring, uptime checks, and webhook monitoring.
- Search is not yet production-grade.
- Media processing lacks thumbnail generation, moderation status, and lifecycle cleanup.

## Engineering Priorities

Immediate priorities:

1. Stabilize production deployment and environment management.
2. Add automated migration process for staging and production.
3. Add structured logging and error monitoring.
4. Add critical path tests for auth, profiles, discovery, messaging, premium, Square, AI, and voice.
5. Add server-side rate limiting.
6. Add event tracking.
7. Build admin and moderation foundation.
8. Add analytics dashboards for activation, retention, trust, and revenue.

Principle:

Do not add major new user-facing features until production reliability, moderation, and measurement are strong enough to support growth.

## Infrastructure Priorities

Near-term:

- Separate local, staging, and production environments.
- Use separate Clerk apps for staging and production.
- Use separate Supabase projects for staging and production.
- Use Paystack test keys in staging and live keys only in production.
- Use separate OpenAI keys and budgets per environment.
- Add environment variable validation at startup.
- Add database backup verification.

Medium-term:

- Add Vercel or hosting platform preview checks.
- Add scheduled jobs.
- Add queue-backed background workers.
- Add Redis for rate limits, counters, and short-lived caches.
- Add CDN/media processing if media volume grows.

Long-term:

- Add analytics warehouse.
- Add dedicated search service.
- Add specialized realtime voice provider.
- Add multi-region strategy only after strong traction.

## Production Readiness Checklist

Must-have before public production launch:

- Staging environment exists.
- Production environment exists.
- Environment variables are documented and validated.
- All migrations applied cleanly from an empty database.
- Automated build passes.
- Lint passes.
- Critical smoke tests pass.
- Clerk routes and protected app routes verified.
- Supabase service key remains server-only.
- Paystack webhook verification is secure.
- OpenAI API key remains server-only.
- Error monitoring is enabled.
- Structured logging is enabled.
- Admin access is role-gated.
- Reports can be reviewed.
- Users can block/report across core surfaces.
- Rate limits exist for sensitive actions.
- Database backups are enabled.
- Terms, privacy, and safety policy are ready.
- Incident response notes exist.

Nice-to-have before launch:

- Automated end-to-end tests.
- Synthetic uptime checks.
- Product analytics dashboard.
- Moderation dashboard.
- Feature flags.
- Rollback checklist.

## Monitoring Roadmap

Phase 1:

- Add application error monitoring.
- Capture API route errors with route, status, user context hash, and request ID.
- Add uptime checks for homepage, sign-in, discovery, messages, Square, premium, and API health.

Phase 2:

- Add provider monitoring for Clerk, Supabase, Paystack, and OpenAI failures.
- Add webhook delivery monitoring.
- Add slow query tracking.
- Add AI usage and error metrics.

Phase 3:

- Add alert thresholds for:
  - Elevated 500s.
  - Login failure spikes.
  - Payment verification failures.
  - Message send failures.
  - Notification failures.
  - Supabase latency.
  - OpenAI latency/cost spikes.
  - Report volume spikes.

## Logging Roadmap

Logging should be structured and privacy-aware.

Recommended fields:

- `request_id`
- `route`
- `method`
- `status`
- `duration_ms`
- `user_id_hash`
- `domain`
- `action`
- `error_code`
- `provider`

Avoid logging:

- Secrets.
- Clerk tokens.
- Supabase keys.
- Full private messages.
- Full AI prompts containing sensitive user content.
- Payment card data.

Priority logs:

- Auth resolution failures.
- Ownership violations.
- Payment verification.
- Webhook processing.
- Message send failures.
- Report creation.
- AI safety flags.
- Voice session creation and reveal.

## Caching Roadmap

Near-term caching:

- Cache premium status for short periods.
- Cache profile summaries used in cards.
- Cache unread notification count briefly.
- Cache static option lists such as interests and onboarding choices.

Medium-term caching:

- Redis-backed rate limit counters.
- Redis-backed usage counters.
- Cached recommendation batches.
- Cached Square trending topics.
- Cached feed pages for anonymous or public surfaces if introduced.

Long-term caching:

- CDN media variants.
- Edge caching for public static pages.
- Read models for high-traffic feeds and inboxes.

Rules:

- Never cache private user data without a clear keying strategy.
- Invalidate premium status after payment and expiry.
- Invalidate profile card cache after profile edits, photo changes, verification changes, or boost status changes.

## Search Roadmap

MVP search can use Postgres filters. Production search should evolve.

Phase 1:

- Add search over interests, topics, and Square hashtags.
- Add basic profile filters.
- Add indexes for common filters.

Phase 2:

- Add full-text search for Square posts and topics.
- Add profile search by display name or username if usernames are finalized.
- Add admin search for users, reports, payments, and content.

Phase 3:

- Add dedicated search service if Postgres search becomes slow.
- Consider Meilisearch, Typesense, OpenSearch, or hosted alternatives.
- Keep sensitive/private content out of public search indexes.

## CI/CD Roadmap

Immediate:

- Run lint on every pull request.
- Run build on every pull request.
- Prevent direct production deploys from unverified branches.

Next:

- Add TypeScript check explicitly if not covered by build.
- Add migration validation.
- Add unit tests.
- Add API integration tests.
- Add Playwright smoke tests for core flows.

Later:

- Add staging deploy per main branch.
- Add production deploy approval gate.
- Add automated rollback notes.
- Add release tags.
- Add changelog generation.

Recommended CI commands:

- `npm.cmd run lint`
- `npm.cmd run build`
- Future: `npm.cmd test`
- Future: `npm.cmd run test:e2e`

## Security Roadmap

Immediate:

- Centralize rate limiting.
- Standardize authorization helpers.
- Audit all API routes for client-submitted user IDs.
- Validate environment variables at runtime.
- Add admin-only route protection before admin features expand.
- Confirm Paystack webhook signature verification.

Next:

- Add abuse detection based on message, save, Square, report, and voice behavior.
- Add moderation case system.
- Add security event logging.
- Add session/device review foundation.
- Add dependency vulnerability checks.

Later:

- Formal security review.
- Penetration testing before major public launch.
- Data retention policy.
- Account deletion workflow that handles dependent data.
- Role-based admin access with audit logs.

## Performance Roadmap

Immediate:

- Add pagination to all list endpoints.
- Add query timing logs.
- Review slow Supabase queries with `EXPLAIN`.
- Avoid large nested selects in high-traffic endpoints.
- Ensure discovery and Square feeds have stable cursor pagination.

Next:

- Precompute recommendation batches.
- Denormalize profile card read models.
- Cache notification counts.
- Add Square trending aggregation.
- Add message pagination by cursor.

Later:

- Partition high-volume tables.
- Add Redis.
- Move heavy jobs out of request path.
- Add search infrastructure.
- Add media transformation pipeline.

## Testing Roadmap

Testing should focus first on the flows where bugs create safety, privacy, or payment risk.

Unit tests:

- Profile completeness calculation.
- Discovery eligibility.
- Match score calculation.
- Premium gate logic.
- Usage counter logic.
- AI prompt output validation.

Integration tests:

- Authenticated profile update.
- Onboarding completion.
- Discovery excludes self, blocked, passed, incomplete, and private profiles.
- Save/pass persistence.
- Mutual save creates messaging permission.
- Conversation access is member-scoped.
- Notifications read/unread.
- Square post/comment/like/report.
- Premium checkout verification.
- Voice session reveal timing.

End-to-end tests:

- Signup to onboarding to profile completion.
- Discovery to save/pass.
- Mutual save to message.
- Square post and comment.
- Premium upgrade.
- AI profile coach.
- Voice match flow.

Security tests:

- Cannot edit another profile.
- Cannot read another conversation.
- Cannot send as another user.
- Cannot mark premium from client input.
- Cannot assign verification badges.
- Cannot access private room without permission.

## Analytics Roadmap

Immediate:

- Define event taxonomy.
- Add server-side event write helper.
- Track activation funnel.
- Track discovery and matching funnel.
- Track messaging funnel.
- Track report/block events.

Next:

- Add daily aggregate tables.
- Add retention dashboards.
- Add premium funnel.
- Add Square engagement quality metrics.
- Add voice session completion metrics.

Later:

- Add warehouse export.
- Add cohort analysis.
- Add churn prediction signals.
- Add experiment tracking.

Core metrics:

- Signup conversion.
- Onboarding completion.
- Profile quality completion.
- Discovery unlock rate.
- Recommendation save rate.
- Mutual save rate.
- Message reply rate.
- Day 1, Day 7, Day 30 retention.
- Report rate.
- Block rate.
- Premium conversion.

## Admin Roadmap

Release admin in layers.

Admin v1:

- Admin login and role guard.
- User lookup.
- Profile lookup.
- Reports queue.
- Basic moderation actions.
- Admin audit log.

Admin v2:

- Message report review.
- Square report review.
- Voice room/session report review.
- Payment lookup.
- Subscription support.
- Feature flags.

Admin v3:

- Moderation case workflow.
- Trust scoring.
- Bulk actions with safeguards.
- Appeals.
- Analytics dashboards.
- Operational alerts.

## Moderation Roadmap

Immediate:

- Unify reports from profiles, messages, Square, and voice.
- Add basic admin review queue.
- Add report status lifecycle.
- Add moderation notes.

Next:

- Add AI-assisted triage.
- Add repeat offender detection.
- Add content removal actions.
- Add user warnings and temporary restrictions.

Later:

- Add appeals.
- Add policy taxonomy.
- Add moderator performance metrics.
- Add automated spam network detection.

Moderation principles:

- Safety is not premium.
- AI assists but humans decide serious enforcement.
- Anonymous Square posts must still be accountable server-side.
- Voice rooms need fast reporting and room host controls.

## Future Architecture Decisions

Decisions to make before scaling heavily:

- Whether to keep all backend logic in Next.js route handlers or introduce separate workers/services.
- Which queue system to use.
- Which Redis provider to use.
- Which analytics warehouse to use.
- Which search service to use.
- Which realtime provider to use for production voice.
- Whether to use Supabase Realtime for messaging or a dedicated realtime layer.
- Whether media should remain public by default or move toward signed URLs.
- How to structure admin RBAC.
- How to enforce data retention and deletion policies.

Recommended decision style:

- Keep the monolith until operational pain is real.
- Extract workers before extracting services.
- Add queues before adding microservices.
- Prefer managed services until the team has enough operational capacity.

## Recommended Engineering Milestones

### Milestone 1: Production Foundation

Deliver:

- Staging environment.
- Production environment.
- Environment validation.
- Automated migration checklist.
- Error monitoring.
- Structured logs.
- Public launch smoke test checklist.

### Milestone 2: Security And Trust Hardening

Deliver:

- Central authorization helpers.
- Rate limiting.
- Unified report model.
- Admin v1.
- Admin audit logs.
- Critical security tests.

### Milestone 3: Analytics And Growth Measurement

Deliver:

- Event tracking.
- Activation funnel.
- Discovery/matching funnel.
- Messaging funnel.
- Retention dashboard.
- Premium funnel.

### Milestone 4: Performance And Scale

Deliver:

- Cursor pagination everywhere.
- Query performance review.
- Cached profile summaries.
- Cached notification counts.
- Recommendation batch foundation.
- Square trending aggregation.

### Milestone 5: Product Reliability

Deliver:

- End-to-end smoke tests.
- Payment webhook monitoring.
- AI usage monitoring.
- Voice provider decision.
- Media processing strategy.
- Rollback process.

## Recommended Releases 5-9

### Release 5: Production Readiness And Admin Foundation

Build first because the product now has enough surfaces that operations and moderation need to catch up.

Scope:

- Staging and production environment checklist.
- Environment validation.
- Admin v1.
- Unified reports queue.
- Admin audit logs.
- Error monitoring.
- Structured logging.
- Rate limiting.

Why first:

- Reduces launch risk.
- Protects users.
- Gives the team visibility into issues.
- Supports all later releases.

### Release 6: Analytics, Events, And Product Intelligence

Scope:

- Event tracking system.
- Activation funnel.
- Discovery funnel.
- Messaging funnel.
- Square engagement metrics.
- Premium conversion metrics.
- Voice session metrics.
- Retention dashboard.

Why second:

- Product decisions need evidence.
- Premium, Square, AI, and voice should be evaluated by quality metrics, not guesses.

### Release 7: Search, Discovery Filters, And Recommendation Infrastructure

Scope:

- Better profile filters.
- Square topic search.
- Full-text search foundation.
- Recommendation batch table.
- Boost-aware recommendation ranking.
- Cached profile cards.

Why third:

- Improves core product value after measurement and safety are in place.
- Prepares for larger user density.

### Release 8: Realtime And Communication Upgrade

Scope:

- Realtime messaging if justified.
- Typing/read UX improvements.
- Push notification foundation.
- Production voice provider evaluation or integration.
- Voice room host controls.

Why fourth:

- Communication quality matters after the matching loop is stable.
- Realtime features add operational complexity and should follow monitoring and rate limits.

### Release 9: Advanced Trust, Moderation, And Personalization

Scope:

- Moderation v2.
- AI-assisted triage.
- Appeals.
- Trust scoring.
- Personalized Square feed improvements.
- Better AI safety workflows.
- Account deletion and data lifecycle improvements.

Why fifth:

- This deepens platform quality after growth and communication systems have matured.

## Final Engineering Recommendation

The next engineering phase should prioritize production confidence over feature expansion. TribeApp already has the major product pillars. The strongest path is:

1. Make the system observable.
2. Make it safe to operate.
3. Measure the core funnels.
4. Improve performance where metrics show pressure.
5. Expand realtime, search, and personalization only after the operational foundation is solid.

This keeps TribeApp aligned with its product principles: trust before growth, quality over quantity, and connections over attention.
