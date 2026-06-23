# TribeApp Product Audit

Date: June 23, 2026

## Executive Summary

TribeApp is currently a polished front-end prototype for a personality-first social discovery product. It presents the core product direction clearly: discover people through temperament, values, circles, availability, conversation prompts, and match signals rather than through shallow profile browsing.

The current implementation is not yet an MVP backend product. It has no authentication, database, API layer, persisted user state, onboarding flow, real matching engine, messaging system, moderation tooling, or production privacy controls. The next phase should preserve the strong product feel while building the minimum trustworthy social graph underneath it.

## Features Already Implemented

- Next.js App Router project with TypeScript, React, Tailwind CSS, and lucide-react icons.
- Single-screen discovery workspace at `/`.
- Responsive three-column product layout:
  - Left navigation and discovery controls.
  - Main match card grid.
  - Right selected-profile detail panel.
- Static profile model with:
  - Name, age, city, avatar, match score, archetype, temperament, pace, availability, signal, bio, traits, circles, prompts, shared values, and personality axes.
- Local profile artwork in `public/avatars`.
- Match card selection behavior.
- Client-side filter buttons for profile traits.
- Client-side prompt-mode segmented control for `Deep talk`, `Soft plans`, and `New circle`.
- Client-side volatile saved-state toggle.
- Metadata configured for the Tribe product.
- Project README documenting the stack and main files.
- ESLint and production build scripts.

## Placeholder Features

- Left navigation items (`Circles`, `Inbox`, `Rituals`) are non-functional buttons.
- Notification button is visual only.
- Search input does not filter or query data.
- `New Signal` button does not open onboarding, profile editing, or signal creation.
- Signal mix sliders are visual-only controls and do not affect matching.
- Match score is hardcoded.
- Save/unsave state exists only in local React memory and resets on refresh.
- `Start Thread` and send-introduction buttons do not create conversations.
- Circle overlap is static and not calculated from real memberships.
- Values in common are static and not computed from user data.
- Availability is static text, not a scheduling or preference system.
- Profile prompts are static, not user-authored or AI-generated.
- No loading, empty, error, onboarding, account, settings, privacy, or report/block states.
- Default public SVG assets from the scaffold remain unused.
- Two avatar assets (`imani.png`, `ren.png`) are present but unused.

## Missing MVP Features

- User authentication and account lifecycle.
- New-user onboarding for personality, values, social goals, location, availability, and privacy preferences.
- Editable user profile.
- Persistent user data and discovery preferences.
- Backend API for profiles, recommendations, saves, blocks, reports, and conversations.
- Real discovery feed populated from database records.
- Matching/recommendation logic.
- Messaging system with conversation permissions and safety controls.
- Blocking, reporting, moderation review, and trust/safety flows.
- Privacy settings for precise location, age visibility, profile visibility, and discoverability.
- Notification preferences and transactional emails.
- Real search/filter behavior.
- Production deployment configuration.
- Analytics/telemetry for activation, match quality, retention, and safety events.
- Test coverage for core components and future API behavior.

## Current Architecture

- Framework: Next.js `16.2.9` using the App Router.
- Runtime model: static single route with a client component in `src/app/page.tsx`.
- Styling: Tailwind CSS v4 utilities plus global base styles in `src/app/globals.css`.
- UI assets: local static images in `public/avatars`; Next image optimization is used for profile avatars.
- State: React `useState` and `useMemo` only.
- Data: hardcoded profile array in the page component.
- Backend: none.
- Database: none.
- API routes/server actions: none.
- Authentication: none.
- Deployment-specific config: none beyond default `next.config.ts`.

This architecture is appropriate for a product prototype, but the next stage should split UI components, domain types, data access, auth, and matching services into separate layers.

## Recommended Database Design

Use Postgres as the primary database. It gives TribeApp strong relational modeling for users, circles, conversations, reports, and permissions, while also supporting future AI matching with `pgvector` and location features with PostGIS if needed.

Recommended core tables:

- `users`: id, email, phone, auth_provider_id, status, created_at, updated_at, last_seen_at.
- `profiles`: user_id, display_name, birthdate, city, region, country, bio, avatar_url, archetype, temperament_summary, profile_visibility, discoverable, created_at, updated_at.
- `profile_preferences`: user_id, discovery_radius, location_precision, age_range_min, age_range_max, preferred_pace, relationship_intents, notification_settings.
- `traits`: id, slug, label, category.
- `profile_traits`: user_id, trait_id, weight, source.
- `values`: id, slug, label.
- `profile_values`: user_id, value_id, rank, note.
- `interests`: id, slug, label, category.
- `profile_interests`: user_id, interest_id, weight.
- `prompts`: id, category, text, active.
- `profile_prompt_answers`: id, user_id, prompt_id, answer, visibility, created_at.
- `availability_windows`: id, user_id, day_of_week, start_time, end_time, cadence, visibility.
- `circles`: id, name, description, city, visibility, owner_id, created_at.
- `circle_memberships`: circle_id, user_id, role, status, joined_at.
- `discovery_signals`: id, user_id, signal_type, payload_json, expires_at, created_at.
- `recommendations`: id, viewer_id, candidate_id, score, reasons_json, model_version, shown_at, dismissed_at.
- `saves`: viewer_id, candidate_id, created_at.
- `passes`: viewer_id, candidate_id, reason, created_at.
- `blocks`: blocker_id, blocked_id, reason, created_at.
- `reports`: id, reporter_id, reported_user_id, reported_message_id, category, details, status, created_at.
- `conversations`: id, type, status, created_by, created_at, updated_at.
- `conversation_members`: conversation_id, user_id, role, joined_at, last_read_at.
- `messages`: id, conversation_id, sender_id, body, moderation_status, created_at, edited_at, deleted_at.
- `message_reactions`: message_id, user_id, reaction, created_at.
- `embeddings`: owner_type, owner_id, embedding, model, created_at.
- `audit_events`: id, actor_id, action, subject_type, subject_id, metadata_json, created_at.

Important indexes:

- Unique indexes on `users.email`, `profile_traits(user_id, trait_id)`, `profile_values(user_id, value_id)`, `saves(viewer_id, candidate_id)`, and `blocks(blocker_id, blocked_id)`.
- Composite indexes on `recommendations(viewer_id, shown_at)`, `messages(conversation_id, created_at)`, `conversation_members(user_id, last_read_at)`, and `reports(status, created_at)`.
- Optional vector index on `embeddings.embedding`.
- Optional geospatial index for coarse location discovery.

## Authentication Requirements

- Passwordless email sign-in for MVP, with OAuth providers as optional launch polish.
- Secure session management through a proven auth library or hosted auth provider.
- Email verification before profile discoverability or messaging.
- Age gate and terms/privacy consent during onboarding.
- Account deletion, data export, and session revocation.
- Bot and abuse controls: rate limits, device/session tracking, suspicious signup detection.
- Role model for users, moderators, admins, and support operators.
- Privacy controls tied directly into authorization rules, not only UI state.

## Messaging Requirements

- Conversations should require a permission event, such as mutual save, accepted intro, shared circle membership, or explicit invite.
- First message should be prompt-guided to reinforce the product's personality-first positioning.
- Core MVP messaging features:
  - Create conversation.
  - Send text message.
  - List inbox conversations.
  - Read conversation history.
  - Mark read/unread.
  - Block/report from conversation.
  - Rate limit message creation.
- Trust and safety requirements:
  - Message moderation status.
  - Abuse reporting.
  - Blocked users cannot message, discover, or view each other.
  - Optional first-message review or automated moderation before delivery.
- Post-MVP messaging:
  - Typing indicators.
  - Reactions.
  - Voice notes or media.
  - Calendar/plan proposals.
  - Circle group threads.

## AI Integration Opportunities

- Onboarding assistant that helps users describe values, pace, social goals, and conversation preferences.
- Compatibility explanations that translate match data into understandable reasons.
- Embedding-based recommendations using profile text, prompt answers, values, and interests.
- Prompt generation for intros, circle posts, and weekly social rituals.
- Conversation quality nudges, with strict user control and no covert message rewriting.
- Safety moderation for profiles, messages, reports, and images.
- Duplicate/spam profile detection.
- Circle formation suggestions based on overlapping values and availability.
- Search over natural-language intents, such as "people who like quiet creative weekends."
- AI summaries for moderators, reports, and appeal workflows.

AI features should be transparent, optional where sensitive, and designed around privacy. Store model versions and explanation metadata for recommendation audits.

## Security Considerations

- Treat profile data, messages, location, preferences, and values as sensitive personal data.
- Use server-side authorization for every profile, discovery, save, message, block, and report action.
- Do not expose precise location; store and show coarse location unless the user explicitly opts in.
- Encrypt sensitive fields where appropriate and use managed secrets for API keys.
- Add rate limits for signup, login, search, saves, reports, and messaging.
- Use CSRF protection where cookie-based mutations are used.
- Validate all API input with schemas.
- Sanitize and escape user-generated text.
- Add content moderation for profile bios, prompt answers, images, and messages.
- Implement block/report flows before public launch.
- Maintain audit logs for admin/moderator access and sensitive account actions.
- Prepare privacy policy, terms, retention policy, deletion flow, and data export.
- For AI features, defend against prompt injection, avoid leaking other users' private data into model context, and log moderation decisions carefully.

## Scalability Considerations

- Move hardcoded profile data into server-side data access modules before adding real users.
- Split `src/app/page.tsx` into reusable components once backend data arrives.
- Keep recommendation generation asynchronous; store recommendation rows rather than calculating every candidate live.
- Use queues for moderation, notification delivery, embedding generation, and recommendation refreshes.
- Cache discovery feed pages per user/session where privacy rules allow it.
- Use CDN-backed object storage for avatars and future media.
- Add observability early: request logs, error tracking, tracing, background job metrics, and product analytics.
- Start with Postgres, but isolate search/recommendation concerns so specialized services can be added later.
- Design messaging with pagination from the beginning.
- Use feature flags for experiments around matching, AI prompts, onboarding, and trust/safety controls.

## Development Roadmap From MVP To Public Launch

### Phase 1: Prototype Hardening

- Keep current UI but split profile cards, sidebar, details panel, filters, and data definitions into separate files.
- Add basic component tests or smoke tests for filter, save, selected profile, and prompt mode behavior.
- Remove unused scaffold assets if they remain unnecessary.
- Add environment setup docs.
- Define product analytics events.

### Phase 2: Backend Foundation

- Choose auth provider/library.
- Add Postgres and ORM/query layer.
- Create database schema for users, profiles, traits, values, prompts, saves, blocks, reports, conversations, and messages.
- Add seed data matching the current demo profiles.
- Add server-side data fetching for discovery.
- Add API/server actions for saves, profile updates, and discovery preferences.

### Phase 3: User Onboarding And Profiles

- Build signup/login.
- Add onboarding flow for identity, values, traits, pace, social goals, location, and availability.
- Build editable profile settings.
- Persist profile prompt answers.
- Add privacy settings and discoverability toggles.

### Phase 4: Matching MVP

- Implement initial recommendation scoring from values, traits, circles, availability, location, and user preferences.
- Store recommendation explanations.
- Add real filters and search.
- Add dismiss/pass behavior.
- Add feedback events for match quality.

### Phase 5: Messaging And Safety

- Add conversation creation through accepted intros or mutual interest.
- Build inbox and conversation pages.
- Add message send/read flows.
- Add block and report flows.
- Add moderation queue for reports and flagged messages.
- Add rate limits and abuse protections.

### Phase 6: AI-Assisted Discovery

- Generate profile embeddings from approved profile text and prompt answers.
- Add AI-assisted compatibility explanations.
- Add intro prompt suggestions.
- Add moderation classification for profiles/messages.
- Add transparency controls around AI-assisted recommendations.

### Phase 7: Beta Launch

- Invite-only launch in one or two cities/communities.
- Add admin dashboard for users, reports, moderation, invites, and feature flags.
- Add email notifications and notification preferences.
- Instrument activation, retention, message quality, reports, blocks, and match feedback.
- Run privacy and security review.

### Phase 8: Public Launch

- Harden infrastructure, backups, monitoring, and incident response.
- Finalize legal docs and user support workflows.
- Add scalable media storage.
- Add public landing/onboarding entry points.
- Expand recommendation quality testing.
- Prepare launch analytics dashboard and trust/safety response process.

## Immediate Next Steps

1. Decide auth and database stack.
2. Add a real data model and seed the current demo profiles.
3. Implement onboarding and editable profiles.
4. Build save, pass, block, and report persistence.
5. Implement permissioned messaging.
6. Add moderation and privacy controls before inviting real users.
