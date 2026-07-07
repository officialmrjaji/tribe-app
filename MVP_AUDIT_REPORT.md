# TribeApp MVP Audit Report

Date: June 30, 2026

## Executive Summary

TribeApp has moved beyond a prototype into a real MVP foundation. The core loop is mostly present: users can authenticate, complete onboarding, improve a profile, enter database-backed discovery, save/pass, restore passes, unlock messaging after mutual saves, and receive in-app notifications.

The product direction is coherent and differentiated. It feels calmer and more personality-first than a swipe app, and the UI has a consistent visual language across discovery, saved/passed profiles, messaging, notifications, onboarding, and profile editing.

The app is not ready for a public launch yet. It is close to a controlled private beta if safety, legal, moderation, testing, and production operations are addressed first.

## Launch Readiness Estimate

- Controlled internal testing: 80%
- Private beta with invited users: 68%
- Public MVP launch: 58%

Overall launch readiness: 62%

The biggest blockers are safety/legal readiness, moderation workflow, age gating, RLS policy hardening, public media privacy, missing automated tests, and production observability.

## Product Surface Reviewed

- Authentication with Clerk
- Supabase-backed users and profiles
- Personality onboarding
- Profile editing and profile quality
- Profile photos and voice intro uploads
- Discovery and recommendation scoring
- Save, pass, restore, block, and report foundations
- Saved and passed profile pages
- Permission-based messaging
- Notifications
- Protected routes and API ownership checks
- Supabase migrations
- Product planning and implementation reports

## Current MVP Status By Area

| Area | Status | Notes |
| --- | --- | --- |
| User journey | Mostly functional | Core loop exists, but first-run routing can feel indirect and launch/legal steps are missing. |
| Onboarding | Functional | Collects goal, intent, personality type, lifestyle signals, interests, conversation style, and availability. |
| Discovery | Functional MVP | Database-backed, explainable, save/pass enabled, but search and sliders are visual only. |
| Matching | Functional MVP | Uses deterministic scoring over onboarding/profile signals; not personalized by feedback yet. |
| Messaging | Functional MVP | Text-only, permission-based, mutual-save gated, member-scoped. |
| Notifications | Functional MVP | In-app notification list and unread count exist; no realtime, push, or email. |
| Profile quality | Strong MVP foundation | Completeness, photos, prompts, voice intro, verified badge, recent activity. |
| Navigation | Mostly consistent | Main areas are reachable, but active-state awareness is limited outside discovery. |
| UX consistency | Good | Calm visual style is consistent; several controls imply features that are not implemented. |
| Security | Needs hardening | Server ownership is good; RLS policies, media privacy, abuse controls, and age gate need work. |
| Database | Good MVP schema | Covers core objects, but needs policies, lifecycle rules, moderation/admin design, and indexing refinements. |
| API design | Serviceable | Ownership checks are mostly centralized; error handling and malformed JSON handling are inconsistent. |
| Performance | Acceptable for beta | In-memory matching and repeated writes will need redesign before scale. |
| Accessibility | Partial | Labels and semantic elements exist, but interactive cards and icon-heavy controls need a full a11y pass. |
| Mobile responsiveness | Good baseline | Layouts use responsive grids; dense discovery and profile editing need device QA. |
| Error handling | Partial | Many pages have errors; APIs often collapse useful domain errors into generic 500s. |
| Empty/loading states | Good | Discovery, inbox, notifications, saved/passed, and conversation pages have clear states. |
| Production readiness | Not yet | Missing tests, analytics, monitoring, legal docs, moderation operations, and deployment hardening. |

## Critical Findings

### C1. No age gate or age validation

Users can enter any birthdate format that matches `YYYY-MM-DD`, and underage users are not blocked from onboarding, discovery, saving, or messaging. The discovery display hides invalid ages by returning `null`, but that does not prevent an underage account from participating.

Impact: Legal and safety risk, especially because onboarding includes a dating intent.

Recommendation: Add a hard 18+ age gate before onboarding, validate birthdate server-side, prevent underage discovery/messaging, and add account review/deletion handling.

### C2. No public-launch moderation workflow

Reports are written to `reports` and `message_reports`, but there is no moderator queue, admin role, status workflow UI, review SLA, content takedown flow, or user suspension flow.

Impact: Unsafe users/content can be reported but not operationally handled inside the product.

Recommendation: Build a minimal moderator dashboard before public launch: reports inbox, user/profile/message context, status updates, suspend/delete actions, and audit logs.

### C3. Legal and consent surfaces are missing

There is no terms acceptance, privacy policy acceptance, community guidelines acknowledgement, safety policy, support contact, data deletion flow, or consent language for voice/profile media.

Impact: Public launch is not legally or trust-ready.

Recommendation: Add required acceptance during signup/onboarding and permanent links in account/profile settings.

## High Findings

### H1. Profile media is stored in a public Supabase bucket

The `profile-media` bucket is configured as public. Photos and voice intro URLs can be accessed by anyone with the URL, even if a profile is private later.

Impact: Privacy mismatch for a social discovery product.

Recommendation: Move private/member-only media to signed URLs, enforce storage policies, and regenerate/revoke access when visibility changes.

### H2. RLS is enabled but no policies are defined

Migrations enable RLS and revoke grants, while application access uses the server Supabase secret key. This reduces client exposure but leaves little defense in depth if server logic or secrets fail.

Impact: High blast radius from service-key leaks or server-side authorization mistakes.

Recommendation: Add RLS policies for all user-owned tables, even if the app continues using server routes.

### H3. Upload validation trusts client-provided metadata

Media uploads validate MIME type and voice duration from client-provided file metadata/form data. File signatures and actual audio duration are not verified server-side.

Impact: Users can upload disguised files or spoof voice duration.

Recommendation: Validate magic bytes and compute media duration server-side before storing or awarding profile completeness.

### H4. No automated test suite

There are no visible unit, integration, or end-to-end tests for auth routing, ownership, discovery gating, save/pass, messaging permissions, or notification read state.

Impact: Regression risk is high as the app now has a real multi-user state machine.

Recommendation: Add Playwright smoke tests and service-level tests for the most important ownership and permission paths.

### H5. Discovery privacy semantics are ambiguous

Discovery includes profiles where `discoverable = true` and `visibility != private`, which means `members` visibility can still appear in discovery. That may be intended, but the UI label "Members only" is easy to interpret as more private than discovery.

Impact: User trust and privacy confusion.

Recommendation: Define exact semantics: `discoverable` should likely require `visibility = discoverable`; `members` should have a clear separate use.

### H6. Search and signal mix controls appear functional but do not affect recommendations

The discovery search field and "Signal Mix" sliders are visible but not wired to server-side filtering or scoring.

Impact: Users may distrust the product when controls do nothing.

Recommendation: Hide these controls until implemented, or wire them to query parameters and server scoring.

### H7. Messaging unread counts can undercount busy conversations

Inbox unread count is computed from the recent message subset loaded per conversation. Very old unread messages can be missed in high-volume conversations.

Impact: Incorrect unread indicators after scale or long inactive periods.

Recommendation: Use a dedicated aggregate query or persisted unread counter per member.

### H8. Notifications can block core actions

Save and message flows create notifications inline. If notification creation fails, the core action can fail or return a generic error.

Impact: Messaging/saving reliability depends on notification writes.

Recommendation: Make notification creation best-effort or queue it after the core transaction succeeds.

### H9. Abuse prevention is incomplete

Messaging has a basic 5-message-per-minute guard, but save/pass/report/upload/profile-edit APIs do not have rate limits or abuse throttles.

Impact: Spam, storage abuse, report spam, and notification spam risk.

Recommendation: Add route-level rate limits, storage quotas, and report dedupe/abuse controls.

### H10. Account deletion and data retention are missing

The schema cascades many user records, but there is no product/API flow for account deletion, media deletion, data export, or retention policy.

Impact: Privacy and compliance gap.

Recommendation: Add account deletion, media cleanup, export process, and retention rules.

## Medium Findings

### M1. First-run routing can feel confusing

`/api/discover` checks profile completeness before onboarding completion, so a brand-new incomplete account can be pointed toward `/profile/edit`, which then redirects to `/onboarding`.

Recommendation: Check onboarding first, then profile completeness.

### M2. Profile prompt validation mismatches database constraints

The API accepts prompt answers with length 0 to 240, while the database requires stored answers to be 2 to 240 characters. One-character answers can create a database error and generic 500.

Recommendation: Validate non-empty prompt answers with minimum length 2 in the API.

### M3. Birthdate validation is format-only

The profile schema only checks the date string format. Future dates, unrealistic ages, and under-18 ages are not rejected.

Recommendation: Add server-side age range validation.

### M4. Profile photos cannot be deleted, reordered, or marked primary

Users can upload multiple photos, but there is no visible management flow after upload.

Recommendation: Add delete, reorder, set-primary, and alt text editing.

### M5. Voice intro cannot be removed or replaced clearly

Users can upload a voice intro, but the UI does not provide a clear remove action.

Recommendation: Add replace/delete controls and explain privacy.

### M6. Discovery has no pagination or refresh strategy

Candidate fetching is capped at 100 profiles, then scored in application code and sliced to 24.

Recommendation: Add pagination, cursoring, or precomputed recommendation batches.

### M7. Matching does not use negative feedback deeply

Passes hide profiles, but scoring does not learn from save/pass patterns, report history, or match quality feedback.

Recommendation: Add lightweight feedback features after beta data exists.

### M8. Saved profiles can show a Message button even when messaging is not unlocked

The server correctly rejects non-mutual saves, but the saved page does not visually distinguish "saved only" from "mutual save".

Recommendation: Show messaging eligibility and a gentler locked state.

### M9. No discovery block/report UI on profile cards

Block/report endpoints exist and conversation has safety actions, but discovery cards do not expose block/report controls.

Recommendation: Add restrained safety menu to discovery and saved/passed profiles.

### M10. Notification badge is not realtime and can become stale

The badge fetches once on mount. It does not update after notifications are read unless the page reloads or component remounts.

Recommendation: Refresh after read actions or add a simple polling interval.

### M11. Conversation thread lacks pagination

Conversation messages are limited to 100. Older messages are inaccessible.

Recommendation: Add cursor-based history loading.

### M12. Error handling is inconsistent across APIs

Some routes catch errors and return domain-specific messages; others can throw unhandled errors or convert domain errors into generic 500 responses.

Recommendation: Standardize API error helpers for validation, auth, ownership, domain errors, and malformed JSON.

### M13. `currentUser` and profile ensure can create write amplification

Many authenticated requests update `last_seen_at` through `ensureOwnedProfile`.

Recommendation: Throttle last-seen updates or move activity tracking to a cheaper background path.

### M14. No production observability

There is no error tracking, structured logging, analytics, uptime monitoring, or audit dashboard.

Recommendation: Add observability before inviting real users outside a very small test group.

### M15. Planning docs are stale

`MVP_CHECKLIST.md` still marks many completed features as unchecked.

Recommendation: Update planning docs or make `MVP_AUDIT_REPORT.md` the new source of truth.

## Low Findings

### L1. Active navigation state is incomplete

The discovery nav marks only Discover active in `src/app/page.tsx`; other pages have their own headers rather than a shared nav.

Recommendation: Extract a shared app navigation component.

### L2. Empty-state copy references implementation details

The discovery empty state says "The mock profiles are gone." That is useful internally but not ideal for users.

Recommendation: Replace with user-facing copy.

### L3. Some icon buttons need clearer accessible names

Most controls are labeled, but icon-heavy navigation and card-select buttons need a full screen-reader pass.

Recommendation: Add aria labels where card buttons only imply behavior visually.

### L4. Notification links are coarse

Profile-save and mutual-save notifications link to `/saved`, not to a specific profile or conversation unlock state.

Recommendation: Add profile detail routes or highlight the relevant saved profile after navigation.

### L5. Reports use generic reasons

Conversation report action sends a generic reason and details from the UI.

Recommendation: Add a small reason picker before report submission.

## User Journey Audit

The current journey works for a test user:

1. Sign up/sign in with Clerk.
2. Complete onboarding.
3. Edit profile to reach 80% completeness.
4. Enter discovery.
5. Save or pass profiles.
6. Message only after mutual save.
7. Receive in-app notifications.

Main journey gaps:

- No legal/age/safety acceptance before social interaction.
- Onboarding completion alone does not guarantee discovery access; profile quality can block the user afterward.
- The user is not guided clearly from "completed onboarding" to "complete profile to 80%".
- Messaging unlock state is not explained at the saved-profile card level.
- There is no account/settings area for privacy, deletion, or notification preferences.

## Onboarding Audit

Strengths:

- Captures product-differentiating data: goal, intent, personality type, lifestyle signals, interests, conversation style, and availability.
- Multi-step UI is clear and calm.
- Server and database constraints exist for counts and allowed values.

Gaps:

- No age gate or terms/privacy acceptance.
- No progress persistence per partial step until final submission.
- No profile preview at the end.
- No moderation/safety copy before users become discoverable.

## Discovery And Matching Audit

Strengths:

- Replaces mock data with Supabase profiles.
- Hides self, passed users, and blocked users.
- Requires onboarding completion and 80% profile completeness.
- Provides match score, reasons, and score breakdown.
- Shows profile quality, recent activity, verified badge, prompts, photos, and voice intro.

Gaps:

- Search and signal sliders are not functional.
- Matching is deterministic and simple.
- No location radius, age preference, or intent-specific safety filtering.
- No pagination, no load-more, no "refresh recommendations".
- No block/report directly in discovery.
- "Members only" visibility semantics need clarification.

## Messaging Audit

Strengths:

- Permission-based.
- Mutual-save gated.
- Server rejects self-messaging and blocked users.
- Conversation membership is checked before access.
- Text-only MVP is a good safety choice.
- Loading, empty, and error states exist.

Gaps:

- No realtime.
- No pagination.
- No message deletion/editing.
- No moderation queue.
- Reporting UI is too generic.
- No typing/read receipts beyond read status.
- No conversation archive/mute UI despite schema columns.

## Notifications Audit

Strengths:

- In-app notifications exist.
- New message, mutual save, profile save, and conversation-created events are covered.
- Read/unread and mark-all-read exist.

Gaps:

- No realtime or polling.
- No notification preferences.
- No push/email, which is fine for MVP but should be explicit.
- Some notification links are not specific enough.
- Notifications are created inline with core actions.

## Security Audit Summary

Strong points:

- Clerk protects core routes.
- API routes use current session and owned profile lookup.
- Client-submitted user IDs are generally not trusted.
- Conversation membership checks are present.
- Self-interaction constraints exist in several tables.

Needs hardening:

- Add RLS policies, not only RLS enabled/revoked grants.
- Protect media with signed URLs or visibility-aware storage access.
- Add age gate and legal acceptance.
- Add origin/CSRF checks or explicit SameSite/security review for state-changing endpoints.
- Add rate limits across all mutation and upload endpoints.
- Add structured audit logging for moderation, profile changes, and ownership-sensitive actions.
- Validate uploaded content beyond MIME headers.

## Database Audit Summary

Strengths:

- Clear core entities: users, profiles, onboarding, interests, saves, passes, blocks, reports, recommendations, profile media, conversations, messages, reads, notifications.
- Good use of foreign keys and uniqueness constraints.
- Useful indexes exist for many access paths.

Improvements:

- Add RLS policies.
- Add updated_at triggers instead of manual updates everywhere.
- Add moderation/admin tables and audit workflow.
- Add account deletion/media cleanup workflow.
- Add profile visibility policy design.
- Add aggregate unread counters or RPC for unread count.
- Add indexes for common discovery filters like city/country/intent if those become server-side filters.

## API Design Audit Summary

Strengths:

- Zod validation exists for core payloads.
- Ownership is mostly centralized.
- Messaging domain errors map to clear HTTP statuses.

Improvements:

- Standardize malformed JSON handling.
- Standardize domain error classes outside messaging.
- Avoid generic 500s for expected user errors.
- Make notification writes non-blocking or transactional in a deliberate way.
- Add API tests for permission boundaries.

## Performance Audit Summary

Current MVP performance is acceptable for a small beta. It will not scale cleanly without changes.

Likely bottlenecks:

- Discovery loads up to 100 candidate profiles and scores in application code.
- Recommendation rows are upserted on every discovery load.
- `ensureOwnedProfile` can write `last_seen_at` frequently.
- Inbox unread counts are computed from limited recent messages.
- Media upload reads files into memory.
- Notification badge causes separate fetches wherever it appears.

Recommendations:

- Add caching or background recommendation generation.
- Move matching into SQL/RPC or a recommendation worker.
- Add cursor pagination for discovery, messages, and notifications.
- Throttle activity writes.
- Use aggregate unread counts.

## Accessibility Audit Summary

Strengths:

- Many form fields have labels.
- Buttons use visible text.
- Loading and error states are visually clear.

Gaps:

- Card-as-button patterns need better labels and focus states.
- Some status messages should use `role="status"` or `aria-live`.
- Color contrast should be verified with tooling.
- Keyboard-only flows need browser QA.
- File upload controls are native but not highly guided.

## Mobile Responsiveness Audit Summary

Strengths:

- Responsive grids and stacked layouts are used across major pages.
- Dense desktop panels collapse into vertical flows.

Gaps:

- Discovery page is information-heavy on small screens.
- Profile editor is long and may feel overwhelming on mobile.
- Messaging composer is functional but not optimized as a sticky mobile composer.
- Navigation differs per page and could be more predictable on mobile.

## Recommended Pre-Beta Fix List

1. Add age gate and terms/privacy/community-guidelines acceptance.
2. Add minimal moderation dashboard for profile/message/user reports.
3. Add discovery block/report UI.
4. Clarify and enforce visibility semantics.
5. Fix onboarding/profile-completion routing order.
6. Add prompt min-length validation.
7. Hide or implement search and signal sliders.
8. Add basic Playwright tests for signup, onboarding, discovery, save/pass, mutual-save messaging, and notifications.
9. Add rate limiting to mutation/upload/report routes.
10. Add production error tracking and request logging.

## Recommended Public Launch Fix List

1. Add RLS policies for all user-owned data.
2. Move profile media to private/signed access or implement visibility-aware storage.
3. Add account deletion, media cleanup, and retention policy.
4. Add support/contact flow.
5. Add notification preferences.
6. Add message and notification pagination.
7. Add analytics for activation, match quality, retention, and safety.
8. Add admin roles and audit logs.
9. Add deployment monitoring, backups, and incident response docs.
10. Complete accessibility and mobile QA.

## Final Assessment

TribeApp is a credible MVP foundation with a distinct product feel. The core personality-first discovery loop is real, and Phase 4 messaging/notifications complete the first version of the social loop.

The app should not be opened publicly yet. It should first go through a focused hardening sprint around safety, privacy, validation, moderation, and tests. After that, it is well-positioned for a small invited beta with real users.
