# Pass Restore Report

## Current Undo Review

1. **How Undo currently works**

   Undo is available from the discovery page after a user passes a profile. The UI stores the most recently passed profile in client state, then calls `POST /api/profile/pass/undo`. The server finds the most recent active row in `passed_profiles` for the current viewer and deletes it.

2. **Whether it only supports the last pass**

   Yes. The existing undo endpoint only restores the newest active pass for the current user by ordering `passed_profiles.created_at` descending and taking one row.

3. **Whether users can restore any previously passed profile**

   Before this update, no. Users could only undo the latest pass from the discovery page while that local UI state was still available.

4. **Whether the `/passed` page supports Restore**

   Before this update, no. `/passed` only displayed active passed profiles.

5. **Restore implementation**

   This update adds per-profile restore from `/passed`.

## What Changed

- Added `restorePassedProfile` in `src/lib/discovery/service.ts`.
- Added `POST /api/profile/pass/restore`.
- Added a client-side profile collection grid for saved/passed cards.
- Added a `Restore to discovery` button for each passed profile.
- Restoring deletes the matching `passed_profiles` row for the current viewer.
- Restored cards are removed from the passed page immediately.
- A confirmation toast appears after restore.

## Files Changed

- `src/lib/discovery/service.ts`
- `src/app/api/profile/pass/restore/route.ts`
- `src/app/passed/page.tsx`
- `src/components/discovery/profile-collection-page.tsx`
- `src/components/discovery/profile-collection-grid.tsx`
- `PASS_RESTORE_REPORT.md`

## Verification

- `npm.cmd run lint`
- `npm.cmd run build`

Both checks passed.

## Notes

Restored profiles return to discovery by removing the pass record. They will appear again when they satisfy the normal discovery requirements: completed onboarding, discoverable visibility, not blocked, and not currently passed.
