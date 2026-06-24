# TribeApp Security Audit

Review date: 2026-06-24

## Scope

This audit reviews the current Phase 1 authentication and Supabase implementation:

- Clerk integration in `src/app/layout.tsx`, `src/proxy.ts`, `/sign-in`, and `/sign-up`.
- Session handling in `/api/me` and `/api/profile`.
- Supabase client utilities in `src/lib/supabase`.
- Profile ownership logic in `src/lib/profile`.
- Initial schema in `supabase/migrations/20260624000000_phase1_auth_profiles.sql`.

No application code was modified for this audit.

## Executive Summary

The current implementation is a reasonable Phase 1 foundation. Routes are protected with Clerk, profile APIs derive ownership from the authenticated Clerk session, and Supabase tables are locked down by default. The largest security tradeoff is that the app currently uses a Supabase secret key from server-side Next.js routes, which bypasses RLS. That is acceptable for an early server-mediated model, but it makes the application code the primary authorization boundary.

The main risks to address before public launch are missing RLS policies for any future direct client access, lack of database-level consistency checks around duplicated Clerk ownership fields, race conditions during first profile creation, missing rate limits, and the absence of Clerk webhooks for user deletion and profile data synchronization.

## High Priority Findings

### 1. Supabase secret key bypasses RLS

Evidence:

- `src/lib/supabase/server.ts` creates a Supabase admin client with `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase secret/service keys have elevated access and bypass RLS.

Impact:

- If a server route has an authorization bug, RLS will not catch it.
- If the server secret leaks, the database is broadly exposed.

Current mitigation:

- The key is only read from server-side env vars.
- `autoRefreshToken` and `persistSession` are disabled.
- Profile APIs do not accept user IDs or profile IDs from the client.

Recommendation:

- Keep `SUPABASE_SECRET_KEY` server-only and never prefix it with `NEXT_PUBLIC_`.
- Add rate limits and structured authorization tests around every mutation route.
- Consider moving sensitive writes into database RPC functions with explicit checks or adding a non-bypass backend role before launch.

### 2. RLS policies are missing

Evidence:

- The migration enables RLS on all Phase 1 tables.
- It then revokes access from `anon` and `authenticated`.
- No `create policy` statements exist.

Impact:

- This is safe for the current server-mediated model because direct browser table access is denied.
- It becomes a launch blocker if the app starts using Supabase directly from the browser.

Recommendation:

- Keep direct access revoked until a deliberate client-access model exists.
- If browser-side Supabase access is introduced, add policies for `users`, `profiles`, `profile_preferences`, and `user_interests`.
- Because TribeApp uses Clerk instead of Supabase Auth, do not assume `auth.uid()` works unless Clerk JWTs are integrated with Supabase and policies can reliably read the Clerk subject.

### 3. Profile rows are not automatically created by the current UI

Evidence:

- `ensureOwnedProfile()` creates records when `/api/me` or `POST /api/profile` is called.
- The existing homepage remains static and does not call either API.

Impact:

- A signed-in user may not have a Supabase `users` or `profiles` row until a client flow explicitly calls the API.
- This can break assumptions in later onboarding, preferences, and matching work.

Recommendation:

- In the next implementation phase, call `/api/me` from an authenticated app shell or first protected page load.
- Alternatively, use a Clerk webhook to create the internal user/profile record when a Clerk user is created.

## Medium Priority Findings

### 4. Ownership is enforced in application code, not fully at the database layer

Evidence:

- `profiles.user_id` references `users.id`.
- `profiles.clerk_user_id` duplicates `users.clerk_user_id`.
- There is no database constraint requiring the duplicated `profiles.clerk_user_id` to match the linked `users.clerk_user_id`.

Impact:

- Normal API paths are protected, but malformed rows created by a bug, script, or admin operation could create inconsistent ownership data.
- Inconsistent rows could block legitimate profile updates or confuse future matching/messaging logic.

Recommendation:

- Add a composite unique constraint on `users(id, clerk_user_id)`.
- Add a composite foreign key from `profiles(user_id, clerk_user_id)` to `users(id, clerk_user_id)`.
- Consider removing duplicated `profiles.clerk_user_id` if joins are sufficient.

### 5. First profile creation is not atomic

Evidence:

- `ensureOwnedProfile()` performs separate read, insert/update, read, and insert operations.

Impact:

- Two simultaneous first requests for the same Clerk user can race.
- Unique constraints prevent duplicate rows, but one request may fail with a database error instead of recovering cleanly.

Recommendation:

- Use `upsert` on `users.clerk_user_id`.
- Use `upsert` or a transaction/RPC for profile creation.
- On unique-conflict errors, re-fetch the existing row instead of returning a 500.

### 6. Visibility and discoverability can become inconsistent

Evidence:

- `profiles.visibility` can be `private`, `members`, or `discoverable`.
- `profiles.discoverable` is a separate boolean.
- No check constraint keeps these fields in sync.

Impact:

- A profile could be marked `visibility = 'private'` and `discoverable = true`.
- Future discovery queries may show profiles that should be private, depending on which field the query uses.

Recommendation:

- Prefer a single source of truth.
- If both fields remain, add a check constraint such as `discoverable = false OR visibility = 'discoverable'`.

### 7. Database validation is incomplete

Evidence:

- API validation exists for profile patch payloads.
- The database does not enforce several business rules.

Impact:

- Data created by scripts, admin tools, future routes, or compromised backend code can bypass API validation.

Recommendation:

- Add check constraints for non-empty email, valid age ranges, `min_age <= max_age`, non-negative discovery radius, reasonable interest weights, and non-future birthdates.
- Add stricter enum/reference tables for fields like `location_precision`, `preferred_pace`, and relationship intents when these become product-critical.

### 8. Mutating profile APIs lack rate limits and audit writes

Evidence:

- `/api/profile` supports `POST` and `PATCH`.
- `profile_ownership_audit` exists but is not written by current code.

Impact:

- A valid session can repeatedly update profile data.
- Abuse, scripted changes, and suspicious edits are harder to investigate.

Recommendation:

- Add per-user rate limiting to profile mutation routes.
- Write audit rows for profile creation and sensitive profile changes.

### 9. Clerk lifecycle events are not synchronized

Evidence:

- The app reads Clerk data from `currentUser()` when `/api/me` or `POST /api/profile` runs.
- There are no Clerk webhooks.

Impact:

- Deleted Clerk users can leave orphaned app users.
- Email/name/avatar changes can remain stale until a user hits a sync path.

Recommendation:

- Add Clerk webhooks for `user.created`, `user.updated`, and `user.deleted`.
- Verify webhook signatures before processing.
- Use webhooks to create, update, suspend, or delete internal account/profile records.

## Low Priority Findings

### 10. Malformed JSON in `PATCH /api/profile` can produce a server error

Evidence:

- `request.json()` is not wrapped in a `try/catch`.

Impact:

- Bad JSON can result in a 500 instead of a clean 400 response.

Recommendation:

- Catch JSON parse errors and return `{ error: "Invalid JSON" }` with status 400.

### 11. Conditional Clerk provider can hide configuration errors

Evidence:

- `src/app/layout.tsx` only renders `ClerkProvider` when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` exists.
- `src/proxy.ts` still uses Clerk middleware for protected routes.

Impact:

- Missing Clerk environment variables may produce confusing behavior in non-local environments.

Recommendation:

- Fail fast in production when required Clerk variables are missing.
- Keep local setup notices if desired, but make deployment misconfiguration explicit.

### 12. Supabase browser client exists but should not be used for table access yet

Evidence:

- `src/lib/supabase/client.ts` creates a browser client.
- The migration revokes direct table access from `anon` and `authenticated`.

Impact:

- Browser reads/writes will fail until policies and grants are intentionally added.

Recommendation:

- Keep using Next API routes for Phase 1.
- Do not grant browser access until RLS policies are designed and tested.

## Route Protection Coverage

Current coverage is strong for Phase 1.

- Public routes: `/sign-in(.*)` and `/sign-up(.*)`.
- Protected routes: all other non-static routes matched by `src/proxy.ts`.
- API routes: explicitly matched by `/(api|trpc)(.*)`.
- Static files and Next internals are excluded from auth checks.

Notes:

- This matches Clerk's documented pattern where all routes are public by default and must be protected explicitly.
- Future public routes such as webhooks, health checks, robots, or marketing pages must be intentionally added to the public matcher.
- Clerk webhook routes must not be protected by normal user-session auth. They need signature verification instead.

## Clerk Integration Quality

Strengths:

- Uses App Router-compatible Clerk components.
- Uses `clerkMiddleware` in `src/proxy.ts`.
- Uses `auth()` and `currentUser()` inside route handlers.
- Uses custom sign-in and sign-up routes.
- Does not trust client-supplied user IDs.

Gaps:

- Google signup/login still depends on Clerk dashboard configuration.
- Email signup/login still depends on Clerk dashboard configuration.
- No Clerk webhook synchronization.
- No automatic profile bootstrap from the existing UI.
- No custom authorization roles yet, which is fine for Phase 1.

## Supabase Schema Quality

Strengths:

- Tables are scoped well for Phase 1.
- UUID primary keys are used consistently.
- `users.clerk_user_id`, `profiles.user_id`, and `profiles.clerk_user_id` are unique.
- RLS is enabled on all created tables.
- Direct `anon` and `authenticated` access is revoked.

Issues:

- Some explicit indexes duplicate indexes already created by unique constraints.
- No RLS policies exist.
- Some foreign key columns are missing supporting indexes.
- No `updated_at` trigger exists, so timestamps depend on application code.
- Database-level business validation is light.
- Ownership consistency between `users.clerk_user_id` and `profiles.clerk_user_id` is not enforced.

## Missing RLS Policies

Current state:

- No policies exist, which means direct browser table access is denied.
- This is consistent with the current server-only data access pattern.

Policies needed before direct client access:

- Users can select their own `users` row.
- Users can select and update their own `profiles` row.
- Users can select and update their own `profile_preferences` row.
- Users can manage their own `user_interests`.
- Public/discoverable profile reads must only expose intended fields.
- Audit logs should be insert-only from trusted server code or unavailable to clients.

Important:

- Clerk sessions are not the same as Supabase Auth sessions by default.
- RLS policies need a reliable Clerk user ID claim in the Supabase request JWT before they can compare database rows to the current user.

## Missing or Redundant Indexes

Recommended additions:

- `profile_ownership_audit(user_id)` for audit lookups by user.
- `user_interests(interest_id)` for future interest-based matching queries.
- `users(status)` for moderation/admin filtering.
- `profiles(city, region, country)` or normalized location indexes for discovery.
- `profiles(created_at)` and `profiles(updated_at)` for admin and sync workflows.

Potentially redundant indexes:

- `users_clerk_user_id_idx` duplicates the unique index backing `users.clerk_user_id`.
- `profiles_user_id_idx` duplicates the unique index backing `profiles.user_id`.
- `profiles_clerk_user_id_idx` duplicates the unique index backing `profiles.clerk_user_id`.

Recommendation:

- Confirm with `pg_indexes` after migration and remove duplicate indexes if write overhead becomes meaningful.

## Ownership Vulnerabilities

Current protections:

- API ownership comes from Clerk `auth()`.
- Client payloads cannot choose an owner.
- Profile updates are filtered by both the owned profile ID and Clerk user ID.

Remaining risks:

- Database does not enforce that duplicated ownership fields stay consistent.
- Future routes could accidentally expose profile IDs and bypass the current owner lookup pattern.
- Service-key access means a backend bug can bypass database policies.

Recommendations:

- Add database-level ownership consistency constraints.
- Keep API routes owner-derived: never accept `user_id`, `profile_id`, or `clerk_user_id` as authority from the client.
- Add tests for two-user ownership boundaries.

## Data Consistency Risks

- Clerk deletion does not delete or suspend internal users.
- Clerk email/name/avatar changes are only partially synchronized.
- Existing profile display names and avatars are not updated once a profile exists.
- Profile creation can race on first load.
- `visibility` and `discoverable` can disagree.
- `updated_at` fields can go stale if future writes forget to set them.
- Empty email strings can be inserted if Clerk returns no email address.

## Scalability Concerns

- `currentUser()` requires a Clerk lookup when bootstrapping profiles.
- Profile creation currently uses multiple sequential database calls.
- No rate limiting exists on mutation routes.
- No typed Supabase database schema is generated for compile-time safety.
- Future discovery queries will need indexes and pagination before real matching traffic.
- Audit, moderation, and webhook processing should move toward background-safe flows as usage grows.

## Recommended Remediation Order

1. Add profile bootstrap from the authenticated app shell or Clerk `user.created` webhook.
2. Add Clerk webhooks for create/update/delete sync.
3. Make `ensureOwnedProfile()` idempotent under concurrency with upserts or an RPC transaction.
4. Add database constraints for ownership consistency and visibility/discoverability consistency.
5. Add rate limiting and audit writes for profile mutations.
6. Add RLS policies only when direct browser table access is intentionally introduced.
7. Generate Supabase TypeScript types and use them in the Supabase service layer.
8. Add two-user ownership tests for all profile APIs.

## References

- Clerk middleware route protection: https://clerk.com/docs/reference/nextjs/clerk-middleware
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase secure data guidance: https://supabase.com/docs/guides/database/secure-data
