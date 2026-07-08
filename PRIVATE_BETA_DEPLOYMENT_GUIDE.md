# TribeApp Private Beta Deployment Guide

## Recommended Beta Shape

Use a stable Vercel production URL for the 10–20 trusted testers. Vercel
Preview deployments are useful for internal QA, but a stable production URL
avoids changing authentication origins and gives testers one link to bookmark.

The beta remains invite-only at the application layer. AI Companion, Tribe
Plus, and payments remain visible but disabled through centralized feature
flags.

## 1. Connect GitHub To Vercel

1. Confirm the repository is pushed to GitHub and `main` contains the private
   beta commit.
2. In Vercel, choose **Add New > Project** and import the GitHub repository.
3. Keep the detected framework as **Next.js**.
4. Keep the root directory as the repository root.
5. Use `npm run build` as the build command. Vercel's default install command
   is sufficient.
6. Add all required environment variables before the first deployment.
7. Deploy and keep `main` as the production branch.
8. After changing any environment variable, trigger a new deployment; Vercel
   environment changes do not alter deployments that already exist.

Reference:

- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel environments](https://vercel.com/docs/deployments/environments)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)

## 2. Required Vercel Environment Variables

Set these for **Production**. If a Vercel Preview URL will be used for tester
QA, set an appropriate Preview value set as well.

### Required

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
TRIBE_ADMIN_EMAILS
```

`TRIBE_ADMIN_CLERK_USER_IDS` is optional but recommended as a second explicit
admin allowlist.

Never prefix the Supabase secret key or Clerk secret key with `NEXT_PUBLIC_`.
Never commit their values.

### Private Beta Feature Flags

```text
AI_ENABLED=false
PREMIUM_ENABLED=false
PAYMENTS_ENABLED=false
VOICE_ENABLED=true
SQUARE_ENABLED=true
COMMUNITIES_ENABLED=false
EVENTS_ENABLED=false
ANALYTICS_ENABLED=true
```

Do not add OpenAI or Paystack credentials while their features are disabled.
The health endpoint treats these disabled services as intentional beta
deferrals.

## 3. Clerk Production Setup

The local project currently uses Clerk test credentials. Before sharing a
public beta link:

1. Create or activate a Clerk production instance.
2. Copy the production publishable and secret keys into Vercel Production.
3. Add the Vercel production domain or custom domain as an authorized party.
4. Allow the production sign-in and sign-up routes:
   - `/sign-in`
   - `/sign-up`
5. Configure the post-authentication fallback URL as `/`.
6. Add the exact production redirect URLs in Clerk.
7. Confirm the enabled sign-in methods, email verification behavior, and
   session duration.
8. Test sign-up, sign-in, sign-out, expired sessions, and mobile browser
   redirects from the deployed domain.

For ephemeral Vercel Preview URLs, use a separate development/staging Clerk
instance or explicitly allow the selected stable branch URL. Do not broadly
trust arbitrary preview domains.

Reference:

- [Deploy a Clerk app to production](https://clerk.com/docs/guides/development/deployment/production)

## 4. Supabase Production Setup

Use a dedicated production Supabase project if the current project contains
development-only data.

1. Create the production project and protect the organization with MFA.
2. Add the project URL, publishable key, and server secret key to Vercel.
3. Apply every migration in filename order.
4. Confirm RLS is enabled for all application tables.
5. Confirm `anon` and `authenticated` cannot directly access server-owned
   tables.
6. Review the Supabase Security Advisor and Performance Advisor.
7. Enable SSL enforcement and appropriate network restrictions where the plan
   permits.
8. Configure backups and avoid a plan that may pause during the tester window.

Reference:

- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase deployment and branching](https://supabase.com/docs/guides/deployment)

## 5. Migration Checklist

Apply these files in order:

```text
20260624000000_phase1_auth_profiles.sql
20260624000100_phase2_onboarding.sql
20260624000200_phase3_matching_save_pass.sql
20260626000000_phase3_8_profile_quality.sql
20260629000000_phase4_messaging_notifications.sql
20260630000000_release1_trust_polish.sql
20260630010000_release1_5_square_feed.sql
20260630020000_release2_premium_paystack.sql
20260630030000_release3_ai_companion.sql
20260701000000_release4_voice_experience.sql
20260701010000_release_x1_production_readiness.sql
20260707000000_voice_continue_votes.sql
20260708000000_ui_ux_square_refinement.sql
20260708010000_private_beta_access.sql
```

After applying them, verify these private-beta objects:

```text
invite_codes
beta_invite_redemptions
beta_feedback
redeem_beta_invite(text, uuid)
```

The tables use RLS and revoke direct client access. Redemption and feedback
operate through authenticated server routes using the server-only Supabase
client.

## 6. Create Invite Codes

Create codes only in the Supabase SQL Editor or a future admin-only creation
tool. Do not put invite codes in source files, public documentation, browser
logs, or analytics.

Example:

```sql
insert into public.invite_codes (
  code,
  max_uses,
  active,
  expires_at
)
values (
  'REPLACE-WITH-A-RANDOM-CODE',
  5,
  true,
  now() + interval '14 days'
);
```

Prefer a separate random code for each small tester group. Keep total
`max_uses` close to the intended 10–20 testers. Disable a leaked code with:

```sql
update public.invite_codes
set active = false
where lower(code) = lower('REPLACE-WITH-A-RANDOM-CODE');
```

Admins see masked codes, usage counts, and redemption emails on `/admin`.
Full codes are not returned to public or authenticated client routes.

## 7. Storage Bucket Checklist

Confirm both buckets exist:

```text
profile-media
square-media
```

Verify:

- `profile-media` accepts JPEG, PNG, WebP, and supported voice audio types.
- `square-media` accepts only the media types allowed by its migration.
- File-size limits match the migrations.
- Upload paths remain owner-scoped.
- Removing a profile or post also removes or schedules cleanup of its media.
- Public object URLs expose only media intentionally presented in public or
  member-visible product surfaces.
- Uploads work on iOS Safari, Android Chrome, and desktop browsers.

## 8. Admin Setup

1. Set `TRIBE_ADMIN_EMAILS` to a comma-separated allowlist of trusted admin
   email addresses.
2. Optionally set `TRIBE_ADMIN_CLERK_USER_IDS` to a comma-separated allowlist
   of Clerk user IDs.
3. Ensure the configured admin signs in once so the owned Supabase user and
   profile records exist.
4. Open `/admin` and verify the dashboard, beta invite usage, reports,
   moderation, analytics, and feature flags.
5. Sign in as a non-admin tester and confirm `/admin` displays an access-denied
   view and no operational data.

Do not use a shared admin account.

## 9. Pre-Launch Validation

After deploying:

1. Request `/api/health`. It must return HTTP 200 and overall `healthy`.
2. Confirm AI and payments show `degraded` with intentional private-beta
   messages, not `unhealthy`.
3. Open `/beta` while signed out.
4. Create a new tester account and verify onboarding redirects to `/beta`.
5. Try an invalid, expired, inactive, and exhausted invite code.
6. Redeem a valid code and complete onboarding.
7. Confirm the same account cannot consume a second code.
8. Confirm another account cannot exceed the code's `max_uses`.
9. Submit `/feedback` and verify its row in `beta_feedback`.
10. Confirm a signed-in user without beta access is redirected from
    `/feedback` to `/beta`.

## 10. Core Feature Trial

Use at least two complete beta accounts with at least three real profile
photos each.

Verify:

- Authentication and session expiry.
- Onboarding and profile completion.
- Profile photo and voice-intro uploads.
- People recommendations and profile galleries.
- Likes, mutual matches, pass, and restore.
- Conversation creation after mutual like.
- Message send, read status, and notifications.
- Square posts, photos, polls, likes, comments, replies, reposts, and reports.
- Voice matching and room permission prompts.
- Settings, safety controls, feedback, and logout.
- Admin and non-admin access behavior.

## 11. Mobile Testing

Test at minimum:

- iPhone Safari, including a narrow viewport and browser text zoom.
- Android Chrome.
- Desktop Chrome or Edge.

On each mobile device:

1. Open the real Vercel URL, not a local network URL.
2. Test portrait and landscape orientation.
3. Confirm the five-item bottom navigation remains readable.
4. Confirm the notification bell does not cover headings or actions.
5. Open profile galleries and test swipe, zoom, and close.
6. Test the on-screen keyboard on invite, onboarding, feedback, message, and
   Square forms.
7. Upload camera photos and a voice introduction.
8. Accept and deny microphone permission to verify both paths.
9. Confirm modals, error messages, and action buttons remain reachable at
   200% browser zoom.

## 12. Rollback Plan

If the beta deployment fails:

1. In Vercel, promote the last known-good deployment or redeploy the previous
   commit.
2. Disable all invite codes:

   ```sql
   update public.invite_codes set active = false;
   ```

3. Keep the additive beta tables in place. Do not drop them during an incident;
   preserving redemption and feedback records is safer.
4. If Supabase is the failure point, pause tester invitations and restore from
   the appropriate backup or point-in-time recovery option.
5. If Clerk is the failure point, verify production keys, authorized parties,
   and redirect URLs before changing application code.
6. Re-run `/api/health`, one clean sign-up, one invite redemption, and one core
   two-user flow before reopening access.

## 13. Known Limitations

- AI Companion is preview-only and cannot call OpenAI.
- Tribe Plus and Paystack checkout are preview-only and cannot charge users.
- The new private-beta migration must be applied before deploying this commit;
  otherwise `/api/health` returns 503 and invite redemption cannot work.
- Existing accounts that completed onboarding before this release are
  grandfathered so established test data is not locked out. They must redeem a
  beta invite before submitting beta feedback.
- The health endpoint verifies environment presence and database reachability;
  it does not replace end-to-end Clerk, email-delivery, or payment tests.
- Voice surfaces acquire microphone permission and coordinate sessions, but
  production-grade peer audio transport and reliability should be validated
  separately before testers rely on voice as a core communication channel.
- Messaging is not fully realtime; testers may need to refresh or wait for the
  current update cycle.
- The in-memory rate limiter is per server instance. For a 10–20 person beta it
  is a useful guard, but a shared durable limiter is required before a wider
  public launch.
