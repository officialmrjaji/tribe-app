# Supabase Setup Guide

Review date: 2026-06-24

This guide covers the current Phase 1 Supabase setup for TribeApp. The app uses Clerk for authentication and Supabase for application data. Supabase Auth is not the identity provider in the current implementation.

## 1. Required Supabase Project Settings

### Project

- Create or use one Supabase project for TribeApp.
- Use the project's normal hosted Postgres database.
- Keep the `public` schema available because the current migration creates tables in `public`.
- Keep the Supabase Data API enabled for the project.

### API Keys

Use the current Supabase API key model where possible:

- Use a publishable key for browser-safe configuration.
- Use a secret key for server-side Next.js API routes.

Find keys in Supabase:

- Project URL: Project dashboard, usually from the Connect dialog.
- Publishable key: Dashboard -> Settings -> API Keys -> Publishable key.
- Secret key: Dashboard -> Settings -> API Keys -> Secret keys.

Legacy fallback names are supported by the code, but the recommended setup is the new publishable/secret key pair.

### Access Model

The current app is server-mediated:

- Browser users authenticate with Clerk.
- Next.js API routes read the Clerk session.
- Next.js API routes use the Supabase secret key to read and write profile data.
- Direct browser table access is intentionally blocked by the migration.

Do not grant `anon` or `authenticated` table permissions until RLS policies are designed and tested.

### Row Level Security

The migration enables RLS on:

- `users`
- `profiles`
- `profile_preferences`
- `interests`
- `user_interests`
- `profile_ownership_audit`

It also revokes direct table access from `anon` and `authenticated`. This is expected for Phase 1.

## 2. Required Environment Variables

Add these to `.env.local` for local development and to your deployment provider's environment variable settings for production.

| Variable | Required | Safe for client | Server-only | Source |
|---|---:|---:|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Yes | No | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Yes | No | Yes | Supabase secret key |

Current code also supports these legacy fallback names:

| Variable | Use |
|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fallback if `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is missing |
| `SUPABASE_SERVICE_ROLE_KEY` | Fallback if `SUPABASE_SECRET_KEY` is missing |

Recommended local block:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Never add `SUPABASE_SECRET_KEY` to client code, never prefix it with `NEXT_PUBLIC_`, and never commit `.env.local`.

## 3. How To Run The Migration

Migration file:

```text
supabase/migrations/20260624000000_phase1_auth_profiles.sql
```

### Recommended: Supabase CLI

From the project root:

```powershell
npx supabase init
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase migration list
```

Notes:

- If `supabase/config.toml` already exists later, do not re-run `supabase init`.
- `supabase db push` applies migrations from `supabase/migrations` that the remote project has not already recorded.
- Coordinate migration pushes so only one person applies remote migrations at a time.

### Alternative: Supabase SQL Editor

For a one-time early setup, you can paste the contents of the migration into:

```text
Supabase Dashboard -> SQL Editor
```

This works, but it bypasses Supabase CLI migration history. Prefer the CLI before the team starts making regular database changes.

## 4. How To Verify Tables Were Created

Run this in the Supabase SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'users',
    'profiles',
    'profile_preferences',
    'interests',
    'user_interests',
    'profile_ownership_audit'
  )
order by table_name;
```

Expected tables:

- `interests`
- `profile_ownership_audit`
- `profile_preferences`
- `profiles`
- `user_interests`
- `users`

Verify RLS is enabled:

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'users',
    'profiles',
    'profile_preferences',
    'interests',
    'user_interests',
    'profile_ownership_audit'
  )
order by c.relname;
```

Expected result:

- Every row should show `rls_enabled = true`.

Verify direct browser roles do not have table grants:

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in (
    'users',
    'profiles',
    'profile_preferences',
    'interests',
    'user_interests',
    'profile_ownership_audit'
  )
order by table_name, grantee, privilege_type;
```

Expected result:

- No rows.

## 5. How To Test Profile Creation

Prerequisites:

- Clerk environment variables are present in `.env.local`.
- Supabase environment variables are present in `.env.local`.
- The Supabase migration has been applied.
- The dev server has been restarted after env changes.

Start the app:

```powershell
npm run dev
```

Test from the browser:

1. Visit the local app.
2. Sign up or sign in with Clerk.
3. Open browser DevTools on the authenticated app.
4. Run:

```js
await fetch("/api/me").then((response) => response.json());
```

Expected result:

- The response includes `account`, `profile`, and `session`.
- `session.clerkUserId` matches the signed-in Clerk user.
- A row exists in `public.users`.
- A row exists in `public.profiles`.

Verify in Supabase SQL Editor:

```sql
select
  u.id as user_id,
  u.clerk_user_id as user_clerk_id,
  u.email,
  p.id as profile_id,
  p.clerk_user_id as profile_clerk_id,
  p.display_name
from public.users u
left join public.profiles p on p.user_id = u.id
order by u.created_at desc
limit 10;
```

The `user_clerk_id` and `profile_clerk_id` should match for each created profile.

## 6. How To Test Ownership Restrictions

### Test logged-out protection

Use an incognito window or sign out, then request:

```text
/api/profile
```

Expected result:

- The request should not return profile data.
- Clerk may redirect to sign-in, or the route may return an unauthorized response depending on request type.

### Test owner-only profile updates

After signing in, run this in browser DevTools:

```js
await fetch("/api/profile", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    displayName: "Ownership Test",
    id: "00000000-0000-0000-0000-000000000000",
    user_id: "00000000-0000-0000-0000-000000000000",
    clerk_user_id: "fake_owner",
  }),
}).then((response) => response.json());
```

Expected result:

- Only allowed profile fields are applied.
- The client-supplied `id`, `user_id`, and `clerk_user_id` values are ignored.
- The updated profile still belongs to the authenticated Clerk user.

Verify in SQL:

```sql
select id, user_id, clerk_user_id, display_name
from public.profiles
order by updated_at desc
limit 10;
```

### Test two-user separation

1. Create or sign in as User A.
2. Run `fetch("/api/me")` to ensure User A has a profile.
3. Sign out.
4. Create or sign in as User B in a separate browser session.
5. Run `fetch("/api/me")` to ensure User B has a profile.
6. While signed in as User B, run a `PATCH /api/profile` request.
7. Check Supabase.

Expected result:

- User B can update only User B's profile.
- User A's profile remains unchanged.
- There is no API route that accepts User A's profile ID as an update target.

### Test direct table access remains blocked

Because the migration revokes grants from `anon` and `authenticated`, direct browser table access should not be used yet. The SQL grant check in section 4 should return no rows for those roles.

## 7. Common Setup Mistakes

- Putting `SUPABASE_SECRET_KEY` in a `NEXT_PUBLIC_` variable.
- Committing `.env.local`.
- Using the Supabase project ref where the full project URL is required.
- Copying the legacy `anon` key into `SUPABASE_SECRET_KEY`.
- Copying the legacy `service_role` key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Forgetting to restart `npm run dev` after changing `.env.local`.
- Expecting Supabase Auth users to exist. Clerk is the current auth provider.
- Forgetting to apply the migration before testing `/api/me`.
- Testing profile creation without calling `/api/me` or `POST /api/profile`.
- Granting `anon` or `authenticated` table access before writing RLS policies.
- Running schema changes directly in the Supabase Dashboard after adopting CLI migrations.
- Forgetting to configure environment variables in the deployment provider.
- Deleting or rotating Supabase keys without updating `.env.local` and deployment secrets.

## References

- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase database migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase environment management: https://supabase.com/docs/guides/deployment/managing-environments
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
