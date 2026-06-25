# Phase 3 Verification

Date: 2026-06-25

## Scope

This verification reviewed the current Phase 3 discovery system without modifying application code.

Verification methods:

- Code review of discovery, recommendation, and interaction services.
- Code review of API routes for discovery, save, pass, block, and report.
- Code review of the Phase 3 Supabase migration.
- Read-only Supabase data audit using the server key from `.env.local`.

No live write tests were run for block/report during this pass, to avoid changing the current test data. Save/pass were verified through implementation review and current persisted rows already present in Supabase.

## Summary

| Area | Status | Notes |
| --- | --- | --- |
| Discovery | Verified | Database-backed discovery is implemented through `/api/discover`. |
| Discoverability | Verified | Current candidate query requires completed onboarding, `discoverable = true`, and non-private visibility. |
| Match scores | Verified | Scores are calculated from onboarding data, profile city, interests, lifestyle, intent, conversation style, availability, and personality fit. |
| Match reasons | Verified | Human-readable reasons are generated from the same matching signals. |
| Save | Verified | API, service logic, database table, uniqueness, and current saved row exist. |
| Pass | Verified | API, service logic, database table, uniqueness, and current active pass row exist. Passed profiles are hidden. |
| Block | Backend verified | API, service logic, database table, self-block constraint, and discovery exclusion are implemented. No live block rows currently exist. |
| Report | Backend verified | API, service logic, database table, validation, and status workflow are implemented. No live report rows currently exist. |

## Current Live Supabase Snapshot

Read-only audit results:

- Profiles: `2`
- Profiles with completed onboarding flag: `2`
- Profiles discoverable by current rules: `2`
- Onboarding rows: `2`
- Completed onboarding rows: `2`
- Saved rows: `1`
- Passed rows: `1`
- Active passed rows: `1`
- Blocked rows: `0`
- Report rows: `0`
- Persisted recommendation rows: `2`

Current per-viewer result:

- `A. Jaji` currently has `1` eligible candidate.
- `abdulsalam abdulaziz` currently has `0` eligible candidates because that viewer has an active pass against the other test profile.

This means discovery is working, but one account has intentionally hidden the only other test user through pass state.

## Discovery Query

Discovery starts in `src/app/api/discover/route.ts` and delegates to `getDiscoveryRecommendations` in `src/lib/discovery/service.ts`.

Current candidate query:

```ts
const { data, error } = await supabase
  .from("profiles")
  .select("*")
  .neq("user_id", ownedProfile.account.id)
  .not("onboarding_completed_at", "is", null)
  .eq("discoverable", true)
  .neq("visibility", "private")
  .limit(100);
```

Additional in-memory filters:

```ts
profile.user_id !== ownedProfile.account.id &&
!passedProfileIds.has(profile.id) &&
!blockedUserIds.has(profile.user_id) &&
profile.onboarding_completed_at &&
profile.discoverable &&
profile.visibility !== "private"
```

Candidate onboarding rows must also exist and have `completed_at` set.

## Match Score Verification

The match score is calculated in `buildRecommendation` with this model:

- Base score: `48`
- Same city: `+14`
- Same intent: `+16`
- Different intent: `+4`
- Shared interests: `+5` each, capped at `20`
- Shared lifestyle signals: `+4` each, capped at `16`
- Same conversation style: `+11`
- Same availability: `+9`
- Same personality type: `+6`
- One ambivert personality pairing: `+4`
- Other personality pairing: `+2`
- Final score is clamped to `0-100`.

Current read-only calculation:

- `A. Jaji` to `abdulsalam abdulaziz`: eligible, score `100`.
- The reverse direction is currently excluded because of an active passed profile row.

Persisted recommendation rows currently show two `phase3_v1` rows with score `99` from earlier generated discovery calls. The persisted rows will refresh on a successful `/api/discover` call for each viewer.

## Match Reasons Verification

Match reasons are generated in `buildReasons`.

The current eligible pair produced reasons from these signals:

- Same city: Abuja.
- Same intent: friends.
- Shared interests.
- Shared lifestyle signals.
- Same availability.

The implementation also has a fallback reason when no strong overlap is found:

```ts
"Their onboarding signals give enough texture for a first plan."
```

## Save Verification

Implemented route:

- `POST /api/profile/save`

Validation:

- Requires `profileId` as a UUID through `profileActionSchema`.
- Requires an authenticated Clerk session through `getCurrentOwnedProfile`.

Service behavior:

- Looks up the target profile.
- Rejects saving the current user's own profile.
- Upserts into `saved_profiles`.
- Deletes any existing pass row for the same target.

Database support:

- `saved_profiles` primary key: `(viewer_user_id, saved_user_id)`.
- `saved_profiles_no_self` check prevents self-save.
- Indexes support viewer and saved-user lookups.

Current Supabase state:

- `saved_profiles` contains `1` row.

Status: verified.

## Pass Verification

Implemented route:

- `POST /api/profile/pass`

Validation:

- Requires `profileId` as a UUID through `profileActionSchema`.
- Requires an authenticated Clerk session through `getCurrentOwnedProfile`.

Service behavior:

- Looks up the target profile.
- Rejects passing the current user's own profile.
- Upserts into `passed_profiles`.
- Deletes any existing saved row for the same target.
- Discovery excludes active passed profiles.

Database support:

- `passed_profiles` primary key: `(viewer_user_id, passed_user_id)`.
- `passed_profiles_no_self` check prevents self-pass.
- `expires_at` exists for future pass expiry support.

Current Supabase state:

- `passed_profiles` contains `1` row.
- Active passed rows: `1`.
- The active pass is currently the exact reason one viewer sees no candidates.

Status: verified.

## Block Verification

Implemented route:

- `POST /api/profile/block`

Validation:

- Requires `profileId` UUID.
- Requires `reason` between `3` and `120` characters.
- Allows optional `details` up to `1000` characters through the shared report schema, though block currently stores only `reason`.
- Requires an authenticated Clerk session.

Service behavior:

- Looks up the target profile.
- Rejects blocking the current user's own profile.
- Upserts into `blocked_users`.
- Deletes saved/pass rows for that target.
- Discovery hides users blocked by the viewer and users who blocked the viewer.

Database support:

- `blocked_users` primary key: `(blocker_user_id, blocked_user_id)`.
- `blocked_users_no_self` check prevents self-block.
- Index exists for reverse blocked-user lookup.

Current Supabase state:

- `blocked_users` contains `0` rows.

Status: backend verified. UI controls for block are not currently exposed on the discovery page.

## Report Verification

Implemented route:

- `POST /api/profile/report`

Validation:

- Requires `profileId` UUID.
- Requires `reason` between `3` and `120` characters.
- Allows optional `details` up to `1000` characters.
- Requires an authenticated Clerk session.

Service behavior:

- Looks up the target profile.
- Rejects reporting the current user's own profile.
- Inserts into `reports`.
- Returns the created report ID.

Database support:

- `reports` has `open`, `reviewing`, `resolved`, and `dismissed` statuses.
- Default status is `open`.
- `reports_no_self` check prevents self-report.
- Indexes support reporter history and reported-user moderation queues.

Current Supabase state:

- `reports` contains `0` rows.

Status: backend verified. UI controls for report are not currently exposed on the discovery page.

## Discoverability Verification

Discoverability is now handled in two places:

- First-time onboarding completion sets `visibility = discoverable` and `discoverable = true`.
- Profile editing exposes both a discoverable toggle and visibility selector.

Current Supabase state confirms:

- Both test profiles have completed onboarding.
- Both test profiles are discoverable under the current discovery rules.

Status: verified.

## Important Findings

1. Block/report are backend-ready but not user-facing in the discovery UI yet.
2. Passes are currently indefinite because `passDiscoveryProfile` does not set `expires_at`.
3. `getTargetProfile` only checks that the target exists and is not self. Direct API calls with a known profile ID can save/pass/block/report a profile even if that profile is not currently discoverable.
4. Persisted recommendation scores can become stale until `/api/discover` is called again for that viewer.

## Phase 3 Readiness

Phase 3 is functional for database-backed discovery, score generation, match reasons, save, and pass. The block/report foundations exist and are protected by authenticated routes, validation, database constraints, and discovery filtering, but the product UI still needs visible controls for users to invoke those safety actions.
