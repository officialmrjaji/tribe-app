# TribeApp MVP Checklist

Date: June 23, 2026

## Current Prototype

- [x] Next.js app scaffolded.
- [x] TypeScript configured.
- [x] Tailwind CSS configured.
- [x] ESLint configured.
- [x] Discovery workspace screen implemented.
- [x] Static demo profiles implemented.
- [x] Local profile avatar assets added.
- [x] Client-side profile filtering implemented.
- [x] Client-side selected-profile panel implemented.
- [x] Client-side save toggle implemented.
- [x] Prompt mode selector implemented.
- [x] Product audit document created.

## Prototype Hardening

- [ ] Extract profile data from `src/app/page.tsx` into a data module.
- [ ] Extract shared profile/domain types.
- [ ] Split discovery UI into reusable components.
- [ ] Add empty state for filters with no matches.
- [ ] Add loading state pattern.
- [ ] Add error state pattern.
- [ ] Remove unused starter assets if not needed.
- [ ] Add `.env.example`.
- [ ] Add basic component or smoke tests.
- [ ] Document local setup and required Node/npm versions.

## Authentication

- [ ] Select auth provider or library.
- [ ] Add sign up.
- [ ] Add login.
- [ ] Add logout.
- [ ] Add email verification.
- [ ] Add protected routes.
- [ ] Add session-aware navigation.
- [ ] Add account deletion.
- [ ] Add terms and privacy acceptance.
- [ ] Add age gate.

## Database And Backend

- [ ] Select Postgres host.
- [ ] Select ORM/query layer.
- [ ] Add database connection.
- [ ] Add migration tooling.
- [ ] Add users table.
- [ ] Add profiles table.
- [ ] Add preferences table.
- [ ] Add traits and profile traits.
- [ ] Add values and profile values.
- [ ] Add prompts and prompt answers.
- [ ] Add saves, passes, blocks, reports.
- [ ] Add conversations and messages.
- [ ] Add seed data matching the current demo profiles.
- [ ] Add server-side validation.

## Onboarding And Profiles

- [ ] Build onboarding start screen.
- [ ] Collect display name and basic profile data.
- [ ] Collect coarse location.
- [ ] Collect social goals.
- [ ] Collect personality traits.
- [ ] Collect values.
- [ ] Collect interests/circles.
- [ ] Collect availability.
- [ ] Collect prompt answers.
- [ ] Add avatar upload.
- [ ] Add profile preview.
- [ ] Add profile edit page.
- [ ] Add discoverability settings.

## Discovery

- [ ] Load profiles from the database.
- [ ] Persist save/pass actions.
- [ ] Implement real search.
- [ ] Implement server-side filters.
- [ ] Implement recommendation scoring.
- [ ] Store recommendation reasons.
- [ ] Add match explanation UI.
- [ ] Add pagination or feed refresh.
- [ ] Hide blocked users from discovery.
- [ ] Respect privacy settings in discovery queries.
- [ ] Add feedback for match quality.

## Messaging

- [ ] Define messaging permission rules.
- [ ] Create conversation request/intro flow.
- [ ] Add inbox route.
- [ ] Add conversation route.
- [ ] Send messages.
- [ ] Read message history.
- [ ] Mark messages read.
- [ ] Add first-message prompt suggestions.
- [ ] Add block/report from conversation.
- [ ] Rate-limit messages.
- [ ] Add moderation status for messages.

## Safety And Moderation

- [ ] Add report user flow.
- [ ] Add report message flow.
- [ ] Add block user flow.
- [ ] Add moderation queue.
- [ ] Add admin/moderator roles.
- [ ] Add content review status for profiles.
- [ ] Add content review status for prompt answers.
- [ ] Add abuse rate limits.
- [ ] Add audit logs.
- [ ] Add data retention policy.
- [ ] Add privacy policy and terms.

## AI Opportunities

- [ ] Add profile text moderation.
- [ ] Add message moderation.
- [ ] Add onboarding copy suggestions.
- [ ] Add prompt answer suggestions.
- [ ] Add compatibility explanations.
- [ ] Add recommendation embeddings.
- [ ] Add natural-language discovery search.
- [ ] Add report summaries for moderators.
- [ ] Add AI transparency language.

## Deployment And Operations

- [ ] Choose hosting platform.
- [ ] Configure production environment variables.
- [ ] Configure preview deployments.
- [ ] Configure production database.
- [ ] Configure object storage for avatars.
- [ ] Add error tracking.
- [ ] Add request logging.
- [ ] Add product analytics.
- [ ] Add backup and restore process.
- [ ] Add uptime monitoring.
- [ ] Add incident response checklist.

## Beta Launch Readiness

- [ ] Invite-code system.
- [ ] Seed one initial city/community.
- [ ] Moderator dashboard.
- [ ] Support contact flow.
- [ ] Safety guidelines.
- [ ] First-run onboarding QA.
- [ ] Discovery quality QA.
- [ ] Messaging safety QA.
- [ ] Accessibility pass.
- [ ] Mobile responsive QA.
- [ ] Privacy review.
- [ ] Security review.

## Public Launch Readiness

- [ ] Public landing/onboarding path.
- [ ] Scalable avatar/media storage.
- [ ] Hardened matching pipeline.
- [ ] Feature flags.
- [ ] Analytics dashboards.
- [ ] Moderation staffing plan.
- [ ] Legal documents finalized.
- [ ] Production observability reviewed.
- [ ] Launch rollback plan.
- [ ] Launch success metrics defined.

