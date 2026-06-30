# Release 2.0: Tribe Premium Report

## Summary

Release 2.0 adds the Tribe Premium foundation with Paystack-backed checkout, server-side payment verification, subscription status, boost activation, premium badges, feature gates, restore purchases, and usage counters.

This release does not add AI, ads, or payment-gated core messaging.

## Implemented

- Added Paystack transaction initialization and verification.
- Added Paystack webhook endpoint with `x-paystack-signature` HMAC validation.
- Added protected Premium API routes:
  - `GET /api/premium/status`
  - `POST /api/premium/checkout`
  - `POST /api/premium/verify`
  - `POST /api/premium/restore`
  - `POST /api/premium/webhook`
- Added Premium pages:
  - `/premium`
  - `/premium/manage`
  - `/premium/checkout/verify`
- Added seeded plans:
  - Boost: 2 weeks, 1 month
  - Premium: 2 weeks, 1 month, 3 months, 6 months, 1 year
- Added subscription records and boost records after successful payment verification.
- Added restore purchases flow for completed Paystack purchases.
- Added subscription status and boost status.
- Added Premium and Boost badges on discovery/profile surfaces.
- Added usage counters for daily recommendations, daily saves, and undo pass.
- Added Premium feature gates for:
  - See who saved you
  - See who liked you
  - Unlimited undo pass
  - Advanced filters
  - Boost visibility
  - Profile analytics
  - Incognito mode
  - Premium communities later
- Added a small boost ranking lift in discovery while preserving personality-first scoring.

## Database

Added migration:

- `supabase/migrations/20260630020000_release2_premium_paystack.sql`

Tables added:

- `premium_plans`
- `premium_purchases`
- `premium_subscriptions`
- `profile_boosts`
- `premium_usage_counters`

All new tables have RLS enabled and revoke direct anon/authenticated access. Application access remains server-owned through the Supabase service key.

## Environment Variables

Added to `.env.example`:

- `PAYSTACK_SECRET_KEY`
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`

`PAYSTACK_SECRET_KEY` must remain server-only. The public key is available for future client-side Paystack flows, but the current implementation uses server-created authorization URLs.

## Security Notes

- Checkout is created server-side from Clerk-owned profile context.
- The client submits only a plan code, not user IDs or prices.
- Payment verification checks Paystack status, reference, amount, and currency.
- A user cannot claim another user's payment reference.
- Paystack webhook is not Clerk-protected because Paystack cannot provide a Clerk session, but it is protected by signature validation.
- Other Premium APIs remain Clerk-protected.

## Known Limitations

- Cancellation is foundation-only; self-serve cancellation is not implemented.
- Paystack recurring billing plans are not implemented yet; TribeApp stores access periods internally after one-time Paystack payments.
- Usage counters are surfaced and ready for enforcement, but only the product foundation is included in this release.
- Premium communities, AI profile coach, and deeper analytics remain future features.

## Files Changed

- `.env.example`
- `RELEASE2_PREMIUM_REPORT.md`
- `src/app/api/premium/checkout/route.ts`
- `src/app/api/premium/restore/route.ts`
- `src/app/api/premium/status/route.ts`
- `src/app/api/premium/verify/route.ts`
- `src/app/api/premium/webhook/route.ts`
- `src/app/page.tsx`
- `src/app/premium/checkout/verify/page.tsx`
- `src/app/premium/manage/page.tsx`
- `src/app/premium/page.tsx`
- `src/app/premium/upgrade-client.tsx`
- `src/app/profiles/[profileId]/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/discovery/profile-collection-grid.tsx`
- `src/components/premium/premium-badge.tsx`
- `src/lib/discovery/service.ts`
- `src/lib/premium/paystack.ts`
- `src/lib/premium/service.ts`
- `src/proxy.ts`
- `supabase/migrations/20260630020000_release2_premium_paystack.sql`

## Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

## Setup Required Before Testing

1. Apply the new Supabase migration manually in the Supabase SQL Editor.
2. Add Paystack credentials to `.env.local`:
   - `PAYSTACK_SECRET_KEY`
   - `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
3. Configure the Paystack webhook URL:
   - `/api/premium/webhook`
4. Restart the dev server after adding environment variables.

## References

- Paystack Transaction API: https://paystack.com/docs/api/transaction/
- Paystack Webhooks: https://paystack.com/docs/payments/webhooks/
