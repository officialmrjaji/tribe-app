# TribeApp Technical Roadmap

Date: June 23, 2026

## Current Technical Baseline

The project is a standalone Next.js app with:

- Next.js `16.2.9` App Router.
- React `19.2.4`.
- TypeScript.
- Tailwind CSS v4.
- lucide-react icons.
- One primary client component at `src/app/page.tsx`.
- Hardcoded demo profile data in the page component.
- Local avatar images in `public/avatars`.
- No backend, database, auth, API routes, tests, or deployment-specific config.

This is a good prototype baseline, but it should be decomposed before adding production behavior.

## Target Architecture

Recommended production direction:

- Frontend: Next.js App Router with a mix of Server Components and Client Components.
- API: Server Actions or route handlers for mutations and integration endpoints.
- Database: Postgres with an ORM/query layer.
- Auth: Hosted auth or proven Next-compatible auth library.
- Storage: Object storage for avatars and future media.
- Jobs: Queue for embeddings, moderation, emails, and recommendation refreshes.
- AI: Model gateway/service module with moderation and recommendation use cases separated.
- Observability: Error tracking, logs, traces, product analytics, and moderation metrics.

## Recommended Folder Direction

As the product grows, move from a single page file to a domain-oriented structure:

```text
src/
  app/
    page.tsx
    onboarding/
    profile/
    discovery/
    inbox/
    settings/
    api/
  components/
    discovery/
    profile/
    messaging/
    layout/
    ui/
  features/
    auth/
    discovery/
    matching/
    messaging/
    moderation/
    onboarding/
  lib/
    db/
    auth/
    ai/
    analytics/
    validation/
  server/
    actions/
    queries/
    jobs/
  types/
```

## Phase 1: Prototype Hardening

Goal: keep the current UI behavior while preparing the codebase for real data.

- Extract the hardcoded `Profile` type into a shared type file.
- Extract demo profile data into a seed/demo data module.
- Split `src/app/page.tsx` into:
  - `DiscoveryShell`
  - `SidebarNav`
  - `SignalMix`
  - `ProfileCard`
  - `ProfileDetailPanel`
  - `FilterBar`
- Add smoke tests for filtering, profile selection, saved state, and prompt mode.
- Remove unused scaffold assets if they remain unnecessary.
- Add an `.env.example` before backend integration.
- Define analytics event names in documentation.

## Phase 2: Backend Foundation

Goal: introduce real persistence without changing the product feel.

- Choose ORM/query layer.
- Add Postgres connection.
- Create schema migrations for users, profiles, traits, values, prompts, saves, passes, blocks, reports, conversations, and messages.
- Seed the current demo profiles from the database.
- Add server-side discovery query.
- Add mutation endpoints/server actions for save and pass.
- Add validation schemas for all incoming data.
- Add error and empty states to the UI.

## Phase 3: Authentication And Onboarding

Goal: let real users create trustworthy profiles.

- Add passwordless email auth.
- Add session handling.
- Add email verification.
- Build onboarding steps:
  - Basic account.
  - Display profile.
  - Personality/traits.
  - Values.
  - Social goals.
  - Location and privacy.
  - Availability.
  - Prompt answers.
- Gate discovery until onboarding is complete.
- Add profile edit/settings pages.
- Add account deletion and logout.

## Phase 4: Matching MVP

Goal: replace hardcoded match scores with explainable recommendation logic.

- Build initial scoring from:
  - Shared values.
  - Trait compatibility.
  - Social pace.
  - Availability overlap.
  - Location/coarse proximity.
  - Circle overlap.
  - User discovery preferences.
- Store recommendation rows with score and reasons.
- Add pass/dismiss behavior.
- Add feedback collection for recommendation quality.
- Add discovery pagination.
- Add server-side search/filter support.

## Phase 5: Messaging And Safety

Goal: support safe permissioned conversations.

- Add conversations and messages tables.
- Require mutual save, accepted intro, or shared-circle permission before messaging.
- Add inbox route.
- Add conversation route.
- Add send/read message actions.
- Add first-message prompt guidance.
- Add block/report actions everywhere a user or message appears.
- Add moderation status to profiles and messages.
- Add rate limits for messaging, saves, reports, and intro requests.

## Phase 6: AI Integration

Goal: use AI to improve discovery quality and safety without weakening user trust.

- Add content moderation for profile text and messages.
- Generate embeddings from approved profile text, values, and prompt answers.
- Add AI-assisted match explanations.
- Add intro prompt suggestions.
- Add onboarding assistant copy suggestions.
- Add moderation summaries for reports.
- Store AI model versions and explanation metadata.
- Add user-facing AI transparency notes where recommendations or text suggestions are AI-assisted.

## Phase 7: Beta Readiness

Goal: safely operate a small invite-only community.

- Add admin dashboard for users, reports, invites, and moderation.
- Add invite codes.
- Add email notifications.
- Add production logging and error tracking.
- Add backup and restore procedure.
- Add privacy policy, terms, and safety guidelines.
- Add basic accessibility pass.
- Add load testing for discovery and messaging endpoints.
- Deploy to production with environment isolation.

## Phase 8: Public Launch

Goal: scale beyond a small beta community.

- Add scalable media storage.
- Add CDN configuration.
- Add feature flags for matching experiments.
- Add advanced notification preferences.
- Add trust/safety SLAs and operational playbooks.
- Add public landing/onboarding path.
- Add analytics dashboards.
- Add retention experiments around circles and social rituals.

## Quality Gates

Before MVP beta:

- `npm run lint` passes.
- Production build passes.
- Auth flows tested.
- Profile privacy rules tested.
- Discovery permissions tested.
- Block/report flows tested.
- Messaging permissions tested.
- Database migrations tested from clean state.
- Seed data works.
- Error monitoring configured.
- Backup procedure verified.

## Technical Risks

- A client-heavy page will become hard to maintain as backend state grows.
- Matching quality can regress if explanation data is not stored with recommendations.
- Messaging creates immediate trust/safety obligations.
- Location and personality data are sensitive and require careful privacy defaults.
- AI features can create privacy and moderation risk if added before clear data boundaries.

