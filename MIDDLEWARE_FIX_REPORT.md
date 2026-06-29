# Middleware Fix Report

## Issue

The dev server was entering an authentication/proxy loop because Clerk-generated internal probe routes such as `/clerk_<timestamp>` were being matched by `src/proxy.ts` and passed through `auth.protect()`.

The previous implementation protected every route except `/sign-in` and `/sign-up`. That was too broad for Clerk's internal development routes and caused failed requests through the proxy layer.

## Middleware Changes

- Replaced the broad public-route exception model with an explicit protected-route matcher.
- Added a Clerk internal route matcher for:
  - `/__clerk(.*)`
  - `/clerk_(.*)`
- Returned early for Clerk internal routes so they are not passed to `auth.protect()`.
- Updated the proxy matcher to exclude `/clerk_*` requests.
- Kept the existing static asset exclusion pattern for common files such as CSS, JS, images, fonts, icons, archives, documents, and manifests.
- Kept `_next` excluded from the broad matcher so Next.js internal routes are not unnecessarily protected.
- Kept API route matching so protected API routes still run through Clerk middleware.

## Protected Routes

The middleware now protects these Tribe routes:

- `/`
- `/onboarding(.*)`
- `/profile(.*)`
- `/saved(.*)`
- `/passed(.*)`
- `/api/discover(.*)`
- `/api/me(.*)`
- `/api/onboarding(.*)`
- `/api/profile(.*)`

## Authentication Posture

Authentication was not weakened. Instead of protecting every possible route by default, the middleware now protects the actual application surfaces that require a signed-in user.

Existing route handlers still perform server-side Clerk session checks, so API ownership and authorization checks remain enforced at the route/data layer.

## Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

`npm run lint` was not used directly because PowerShell blocked the `npm.ps1` shim via execution policy. The same npm script was run through `npm.cmd`.
