# Account & Admin Fix Report

## Summary

Implemented account controls and admin-access fixes without changing authentication ownership rules or permanently deleting user data.

## What Changed

- Added a `/settings` sign-out control that uses Clerk `signOut({ redirectUrl: "/sign-in" })`.
- Replaced the inactive delete-account note with a confirmation UI.
- Added the required checkbox text: "I understand this will permanently remove my account."
- Added a confirmation phrase before users can request deletion.
- Added `POST /api/account/deletion-request` to create an owned `moderation_cases` review item instead of deleting Clerk or Supabase data.
- Protected `/api/account/*` routes in Clerk middleware.
- Changed `/admin` non-admin handling from a hidden not-found response to a clear admin-access page.
- Kept `/admin` protected by Clerk middleware and `requireAdminAccess()`.
- Improved admin allowlist parsing so `TRIBE_ADMIN_EMAILS` and `TRIBE_ADMIN_CLERK_USER_IDS` support comma, semicolon, whitespace, and newline-separated values.
- Updated `RELEASEX1_SETUP_VERIFICATION.md`.

## Admin Verification

- `TRIBE_ADMIN_EMAILS` is present in `.env.local`.
- `TRIBE_ADMIN_CLERK_USER_IDS` remains optional and is currently empty locally.
- The likely current user matches the configured admin email.
- Unauthenticated `/admin` redirects to Clerk sign-in.
- Signed-in non-admin users now receive a clear access-denied page instead of a 404.

A second non-admin browser session was not available for live verification.

## Delete Account Behavior

Full account deletion is intentionally not implemented yet because there is no complete safe cleanup flow for Clerk, Supabase records, storage media, payment records, and moderation history.

The new flow creates or reuses an open `moderation_cases` row with:

- `subject_type = user`
- `reason = account_deletion_request`
- `status = open`
- `priority = high`

This makes the action reviewable and avoids pretending deletion is complete.

## Files Changed

- `RELEASEX1_SETUP_VERIFICATION.md`
- `src/app/admin/page.tsx`
- `src/app/api/account/deletion-request/route.ts`
- `src/app/safety/account-deletion-request.tsx`
- `src/app/safety/page.tsx`
- `src/app/settings/account-actions.tsx`
- `src/app/settings/page.tsx`
- `src/lib/admin/service.ts`
- `src/proxy.ts`

## Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.
