# Phase 2 Verification

Date: 2026-06-24

## Scope

This verification reviews the Phase 2 onboarding implementation without modifying application code.

Verified areas:

- Onboarding data persistence.
- Onboarding completion persistence.
- Discovery access gate.
- Profile editing foundation.
- Returning-user onboarding bypass.

## Verification Summary

| Area | Status | Notes |
|---|---|---|
| Onboarding data is saved in Supabase | Verified by code path and live schema | `/api/onboarding` writes to `onboarding_answers`; live Supabase table is reachable. |
| Onboarding completion is persisted | Verified by code path and live schema | `completed_at` is written to `onboarding_answers`; `profiles.onboarding_completed_at` exists and is updated. |
| Discovery gate works | Verified by code review and unauthenticated route check | Discovery calls `/api/onboarding`; incomplete users are redirected to `/onboarding`; signed-out users are redirected to Clerk. |
| Profile editing works | Verified by code path | `/profile/edit` loads only after onboarding and saves via `PATCH /api/profile`. |
| Returning users bypass onboarding | Verified by code path | Completed users are redirected from `/onboarding` to `/`; discovery renders when `/api/onboarding` returns `completed: true`. |

## Supabase Verification

The connected Supabase project was checked using the server-side Supabase key from local environment variables. Secret values were not printed.

Live schema checks passed:

- `onboarding_answers` table is reachable.
- `profiles.onboarding_completed_at` column is reachable.
- `user_interests.interest_id` is selectable.

This confirms the Phase 2 migration has been applied to the connected Supabase project.

## Onboarding Data Persistence

Relevant files:

- `src/app/api/onboarding/route.ts`
- `src/lib/onboarding/service.ts`
- `src/lib/onboarding/schema.ts`
- `supabase/migrations/20260624000100_phase2_onboarding.sql`

The onboarding submit path:

1. Requires a Clerk-authenticated user.
2. Ensures an internal user/profile record exists.
3. Validates the payload with `onboardingInputSchema`.
4. Upserts a row into `public.onboarding_answers`.
5. Stores:
   - `primary_goal`
   - `intent`
   - `personality_type`
   - `lifestyle_signals`
   - `interests`
   - `conversation_style`
   - `availability`
   - `completed_at`
6. Syncs selected interests into `interests` and `user_interests`.
7. Updates profile preference metadata.

Result: onboarding data is wired to persist in Supabase.

## Onboarding Completion Persistence

Completion is persisted in two places:

- `onboarding_answers.completed_at`
- `profiles.onboarding_completed_at`

`getOnboardingStatus()` treats onboarding as complete when the stored onboarding record has a truthy `completed_at`.

Result: completion status is durable and can be read after refresh, sign-out, and sign-in.

## Discovery Gate

Relevant file:

- `src/app/page.tsx`

The discovery page starts in a checking state and calls:

- `GET /api/onboarding`

Behavior:

- If the request is redirected by Clerk, the browser follows the sign-in URL.
- If the user is authenticated but onboarding is incomplete, the page redirects to `/onboarding`.
- If onboarding is complete, the existing discovery UI renders.
- If verification fails, the user sees a retry state instead of discovery.

Unauthenticated local route check:

- `GET /api/onboarding` returned a Clerk sign-in redirect.

Result: incomplete or signed-out users are prevented from using discovery.

Caveat:

- The discovery gate is client-side. The discovery UI is withheld while the onboarding check runs, but future sensitive discovery data should be guarded server-side before being fetched.

## Profile Editing Foundation

Relevant files:

- `src/app/profile/edit/page.tsx`
- `src/app/profile/edit/profile-editor.tsx`
- `src/app/api/profile/route.ts`
- `src/lib/profile/service.ts`

Behavior:

- `/profile/edit` requires a signed-in Clerk user.
- It ensures the user has an owned profile.
- It redirects incomplete users to `/onboarding`.
- It renders the profile editor only for onboarded users.
- Saves use `PATCH /api/profile`.
- The existing profile API updates only the authenticated user's owned profile.

Editable fields currently include:

- Display name
- Bio
- City
- Region
- Country
- Visibility
- Discoverable toggle

Result: profile editing foundation is implemented and owner-scoped.

## Returning Users Bypass Onboarding

Returning-user behavior is covered in two places:

- `/onboarding` checks onboarding status server-side and redirects completed users to `/`.
- `/` checks onboarding status client-side and renders discovery only when `completed: true`.

Result: users with completed onboarding bypass the onboarding flow and can return to discovery.

## Manual Browser Verification Steps

Use these steps to validate the full authenticated flow locally:

1. Run `npm run dev`.
2. Open `http://localhost:3000`.
3. Sign in with Clerk.
4. If the user has no onboarding record, confirm the app sends the user to `/onboarding`.
5. Complete the onboarding form.
6. Confirm the app redirects to `/`.
7. Refresh `/`.
8. Confirm discovery loads without returning to onboarding.
9. Visit `/profile/edit`.
10. Change a basic profile field and save.
11. In Supabase, verify:
    - `onboarding_answers.completed_at` is populated.
    - `profiles.onboarding_completed_at` is populated.
    - `profile_preferences.relationship_intents` includes the selected intent.
    - `user_interests` contains the selected interests.

## Limitations

- No automated browser test has been added yet.
- No authenticated end-to-end test was run from the terminal because the API requires a live Clerk browser session.
- The existing discovery profiles remain static/mock data.
- Matching, messaging, notifications, and AI are still intentionally out of scope.
- The discovery gate should move server-side before real private discovery data is exposed.

## Verdict

Phase 2 is ready for manual authenticated testing. The Supabase schema is present, the onboarding save path is implemented, completion is persisted, incomplete users are gated away from discovery, profile editing is owner-scoped, and completed users bypass onboarding.
