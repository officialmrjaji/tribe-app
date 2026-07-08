# Temporary Feature Gates Report

## Summary

AI Companion and Tribe Plus purchase actions are temporarily gated for private beta. Both features remain visible as intentional roadmap previews, but users cannot trigger AI requests, checkout, payment verification, restore purchases, or webhook fulfillment while the flags are disabled.

## Feature Flag Implementation

Added centralized feature flags in `src/lib/feature-flags.ts`.

Default beta values:

- `AI_ENABLED=false`
- `PREMIUM_ENABLED=false`
- `PAYMENTS_ENABLED=false`
- `VOICE_ENABLED=true`
- `SQUARE_ENABLED=true`
- `COMMUNITIES_ENABLED=false`
- `EVENTS_ENABLED=false`
- `ANALYTICS_ENABLED=true`

Added `src/lib/feature-response.ts` for consistent disabled-feature API responses.

## AI Routes Disabled

These routes now authenticate first, then return the AI coming-soon response when `AI_ENABLED=false`:

- `POST /api/ai/profile-coach`
- `POST /api/ai/match-coach`
- `POST /api/ai/conversation-coach`
- `POST /api/ai/safety-check`

The AI route handlers no longer import the OpenAI-backed service modules unless `AI_ENABLED=true`.

Additional guard:

- `src/lib/ai/service.ts` now blocks AI service execution while `AI_ENABLED=false`.

## Premium Routes Disabled

These routes now authenticate first, then return the Premium coming-soon response when `PREMIUM_ENABLED=false` or `PAYMENTS_ENABLED=false`:

- `POST /api/premium/checkout`
- `POST /api/premium/restore`
- `POST /api/premium/verify`

The webhook route acknowledges disabled beta state without validating or fulfilling payment events:

- `POST /api/premium/webhook`

Additional guard:

- `src/lib/premium/service.ts` now blocks checkout, verification, and restore execution while Premium or Payments are disabled.

## UI Changes

- `/ai` now renders a polished AI Companion preview with disabled feature cards and a coming-soon modal.
- `/premium` keeps pricing plans visible, but plan buttons show `Coming Soon` and cannot start checkout.
- Premium restore purchase action is disabled while payments are unavailable.
- `/premium/checkout/verify` no longer attempts payment verification while disabled.
- `/premium/manage` shows subscription status without implying active purchase actions.
- `/explore?tab=liked-me` keeps the gated preview visible and explains that Who Liked Me will be available when Tribe Plus launches.
- `/me` and `/settings` keep AI and Premium visible with Coming Soon badges.
- `/api/health` reports disabled AI and payment systems as intentional private-beta deferrals instead of production outages.

## Files Modified

- `src/app/ai/ai-companion-client.tsx`
- `src/app/ai/page.tsx`
- `src/app/api/ai/conversation-coach/route.ts`
- `src/app/api/ai/match-coach/route.ts`
- `src/app/api/ai/profile-coach/route.ts`
- `src/app/api/ai/safety-check/route.ts`
- `src/app/api/premium/checkout/route.ts`
- `src/app/api/premium/restore/route.ts`
- `src/app/api/premium/verify/route.ts`
- `src/app/api/premium/webhook/route.ts`
- `src/app/explore/page.tsx`
- `src/app/me/page.tsx`
- `src/app/premium/checkout/verify/page.tsx`
- `src/app/premium/manage/page.tsx`
- `src/app/premium/page.tsx`
- `src/app/premium/upgrade-client.tsx`
- `src/app/settings/page.tsx`
- `src/lib/ai/service.ts`
- `src/lib/feature-flags.ts`
- `src/lib/feature-response.ts`
- `src/lib/health/service.ts`
- `src/lib/premium/service.ts`

## Future Re-enable Steps

1. Configure OpenAI environment variables.
2. Set `AI_ENABLED=true`.
3. Configure Paystack public and secret keys.
4. Set `PREMIUM_ENABLED=true`.
5. Set `PAYMENTS_ENABLED=true`.
6. Restart the app so server-side flags refresh.
7. Smoke-test `/ai`, `/premium`, checkout, restore, verification, and webhook fulfillment.

## Verification

- `npm run lint` passed.
- `npm run build` passed.

## Notes

No database migration was required. Authentication, onboarding, discovery, profile editing, likes, Explore, matching, messaging, notifications, Square, Voice, Settings, Safety, and Admin were not changed beyond visible AI/Premium coming-soon labels in account hubs.
