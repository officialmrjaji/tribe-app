# Release 3.0: AI Companion Report

## Summary

Release 3.0 adds an optional AI Companion for profile drafting, match explanation, conversation starters, icebreakers, and advisory safety checks. The implementation uses the OpenAI Responses API from server-side routes only.

AI does not replace human conversations, send messages, edit profiles automatically, or make moderation decisions by itself.

## Implemented

### AI Profile Coach

- Improves a user's draft bio.
- Improves profile prompt answers.
- Suggests interests from TribeApp's existing allowed interest set.
- Keeps suggestions optional and copyable.

### AI Match Coach

- Generates clearer match explanations from existing recommendation context.
- Returns match explanation notes and questions to explore.
- Uses current discovery recommendations when a selected profile is available.

### AI Conversation Coach

- Generates conversation starters.
- Generates icebreakers.
- Can use recent conversation context when the user selects a conversation.
- Does not send, queue, or modify messages.

### AI Safety

- Checks pasted content for spam, harassment, and scam signals.
- Returns risk level, category flags, explanation, and recommendation.
- Stores advisory safety check records for future review.
- Does not automatically punish, report, block, or moderate users.

## API Routes

- `POST /api/ai/profile-coach`
- `POST /api/ai/match-coach`
- `POST /api/ai/conversation-coach`
- `POST /api/ai/safety-check`

All routes use Clerk-owned profile lookup and server-side OpenAI calls.

## Pages

- `/ai`

The AI Companion workspace includes separate panels for Profile Coach, Match Coach, Conversation Coach, and AI Safety.

## Database

Added migration:

- `supabase/migrations/20260630030000_release3_ai_companion.sql`

Tables added:

- `ai_suggestions`
- `ai_safety_checks`

Both tables have RLS enabled and direct anon/authenticated access revoked. Writes are handled server-side through existing Supabase service-role access.

## Environment Variables

Added to `.env.example`:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Both are server-side values. `OPENAI_API_KEY` must not be exposed to the client. `OPENAI_MODEL` is configurable so the app can move between OpenAI models without code changes.

## Security And Privacy

- Client never receives the OpenAI API key.
- AI routes do not trust client-submitted user IDs.
- Match coaching only uses profiles available in the user's current discovery set.
- Conversation coaching only uses conversations the user belongs to.
- Safety checks are advisory and do not automatically enforce moderation actions.
- AI outputs are persisted for auditability, but the app does not auto-apply them.

## Files Changed

- `.env.example`
- `RELEASE3_AI_REPORT.md`
- `src/app/ai/ai-companion-client.tsx`
- `src/app/ai/page.tsx`
- `src/app/api/ai/conversation-coach/route.ts`
- `src/app/api/ai/match-coach/route.ts`
- `src/app/api/ai/profile-coach/route.ts`
- `src/app/api/ai/safety-check/route.ts`
- `src/app/page.tsx`
- `src/app/settings/page.tsx`
- `src/lib/ai/openai.ts`
- `src/lib/ai/schema.ts`
- `src/lib/ai/service.ts`
- `src/proxy.ts`
- `supabase/migrations/20260630030000_release3_ai_companion.sql`

## Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

## Setup Required Before Testing

1. Apply the new Supabase migration manually in the Supabase SQL Editor.
2. Add these values to `.env.local`:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
3. Restart the local dev server after adding environment variables.

## References

- OpenAI Responses API: https://platform.openai.com/docs/api-reference/responses/create
- OpenAI Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
