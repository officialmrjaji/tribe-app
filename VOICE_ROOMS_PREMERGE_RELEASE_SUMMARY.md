# Voice Rooms Pre-Merge Release Summary

## Executive Summary

This document compares `main` against `feature/voice-rooms-square-ux`.

Verdict: **GO WITH CONDITIONS**

The feature branch is six commits ahead of `main` and includes the previous trial UX improvements plus the new Voice Rooms and Square discussions redesign. The merge base is current local `main`, so the branch is linearly ahead of `main` in this local repository.

Primary conditions before merge:

- Apply the required Supabase migrations in chronological order before or alongside deployment.
- Confirm the Voice migration is applied before deploying code that can write `moderator`, `locked_at`, `hand_raised_at`, `speaking_since`, or `removed_at`.
- Confirm AI and Premium payments remain feature-gated/off.
- Smoke-test onboarding, profile photos, People filters, realtime messaging, notifications, Square comments, and Voice Room actions with at least two accounts.
- Keep current `main` commit `4bc4dfb426219e841512709e3ef0912c0be4d2eb` as the rollback reference.

## Branch Comparison

| Ref | Commit |
| --- | --- |
| `main` | `4bc4dfb426219e841512709e3ef0912c0be4d2eb` |
| `feature/voice-rooms-square-ux` | `5ed86af63e784d527205bb92c29f5d06a7c89f7f` |
| merge base | `4bc4dfb426219e841512709e3ef0912c0be4d2eb` |

Summary:

- Feature branch ahead of `main`: yes, by 6 commits.
- Local `main` is the merge base.
- No merge was performed.
- No push was performed.
- Local working tree note: `VOICE_ROOMS_SQUARE_UX_ROLLBACK.sql` is untracked and is not part of the feature branch comparison.

## Commits Entering Main

| Commit | Message | Purpose |
| --- | --- | --- |
| `506629e` | `Implement trial version improvements` | Adds trial beta improvements: photo management, multiple upload, onboarding gender foundation, realtime invalidation foundation, Square action refinements, and profile-completion gate updates. |
| `f402ce1` | `Refine trial profile discovery Square and realtime UX` | Adds profile preview, shared public profile layout, simplified People cards, Square detail flow, media viewer, and realtime conversation/notification refresh. |
| `e883aec` | `Refine discovery onboarding square and notification experience` | Adds gender display/filtering, identity locking, full-profile Like/Pass, rediscovery timing, notification cleanup, and Square readability improvements. |
| `0e5a396` | `Fix trial profile image delivery` | Fixes partial profile image failures with a safe storage image wrapper and fallback. |
| `c5b6f73` | `Refine Square People Connections and Chats UX` | Simplifies Square, People, Connections, and chat timestamp UX. |
| `5ed86af` | `Redesign Voice Rooms and Square discussions` | Adds Voice Room controls/permissions/realtime UX and refines Square comment interactions. |

## Files Changed

Total changed files: 62.

### Documentation and Reports

- `TRIAL_IMPROVEMENTS_REPORT.md`
- `TRIAL_UX_PHASE2_REPORT.md`
- `TRIAL_UX_REFINEMENT_REPORT.md`
- `VOICE_SQUARE_UX_REDESIGN_REPORT.md`

Impact: release documentation only. Low risk.

### API Routes

- `src/app/api/discover/route.ts`
- `src/app/api/profile/photos/[photoId]/route.ts`
- `src/app/api/profile/photos/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/realtime/events/route.ts`
- `src/app/api/square/trending/route.ts`
- `src/app/api/voice/rooms/[roomId]/actions/route.ts`

Impact: profile photo management, discovery filters, protected realtime invalidation, Square trending ranking, and Voice Room actions. Medium risk because these affect core beta flows and require migrations.

### App Pages and Screens

- `src/app/explore/page.tsx`
- `src/app/me/page.tsx`
- `src/app/messages/[conversationId]/conversation-thread.tsx`
- `src/app/messages/messages-inbox.tsx`
- `src/app/notifications/notifications-page.tsx`
- `src/app/onboarding/onboarding-flow.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/page.tsx`
- `src/app/profile/edit/profile-editor.tsx`
- `src/app/profile/page.tsx`
- `src/app/profile/preview/page.tsx`
- `src/app/profiles/[profileId]/page.tsx`
- `src/app/saved/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/voice/rooms/[roomId]/voice-room-client.tsx`
- `src/app/voice/voice-home-client.tsx`

Impact: significant user-facing changes to People, profile edit/preview, onboarding, messaging, notifications, Square, and Voice Rooms. Medium risk.

### Shared Components

- `src/components/discovery/profile-collection-grid.tsx`
- `src/components/discovery/profile-collection-page.tsx`
- `src/components/media/safe-storage-image.tsx`
- `src/components/navigation/navigation-frame.tsx`
- `src/components/notifications/notification-badge.tsx`
- `src/components/profile/profile-photo-gallery.tsx`
- `src/components/profile/profile-photo-manager.tsx`
- `src/components/profile/public-profile-actions.tsx`
- `src/components/profile/public-profile-view.tsx`
- `src/components/realtime/realtime-page-refresh.tsx`
- `src/components/square/square-composer.tsx`
- `src/components/square/square-feed.tsx`
- `src/components/square/square-post-card.tsx`
- `src/components/square/square-thread.tsx`

Impact: reusable profile, media, realtime, and Square UI behavior. Medium risk due to broad reuse, but changes are mostly additive/refinement-oriented.

### Libraries and Services

- `src/lib/analytics/service.ts`
- `src/lib/discovery/schema.ts`
- `src/lib/discovery/service.ts`
- `src/lib/messaging/service.ts`
- `src/lib/notifications/service.ts`
- `src/lib/onboarding/options.ts`
- `src/lib/onboarding/schema.ts`
- `src/lib/onboarding/service.ts`
- `src/lib/profile/public-profile.ts`
- `src/lib/profile/schema.ts`
- `src/lib/profile/service.ts`
- `src/lib/realtime/use-realtime-invalidation.ts`
- `src/lib/square/service.ts`
- `src/lib/voice/schema.ts`
- `src/lib/voice/service.ts`
- `src/proxy.ts`

Impact: core business logic for discovery, identity locking, profile media, notifications, Square ranking/interaction, realtime invalidation, and Voice Room permissions. Medium to High risk if migrations are missing or realtime publication setup is incomplete.

### Database Migrations

- `supabase/migrations/20260709000000_trial_improvements.sql`
- `supabase/migrations/20260710000000_trial_ux_refinement.sql`
- `supabase/migrations/20260710010000_trial_ux_phase2_discovery_notifications.sql`
- `supabase/migrations/20260713000000_voice_rooms_square_ux.sql`

Impact: required database/schema changes. High operational importance.

### Tests

- `tests/integration/discovery.integration.test.mjs`

Impact: updates a stale discovery contract assertion to match the newer basic-completion threshold constant. Low risk.

## User-Facing Features

### New Features

- Profile photo replacement, deletion, reordering, and multiple upload.
- Gender capture during onboarding and gender display/filtering where appropriate.
- Profile preview showing how a user appears to others.
- Full public profile presentation reused across self preview and member profile viewing.
- Like/Pass actions from full profile views.
- Safe profile image fallback for unavailable Supabase Storage images.
- Realtime invalidation foundation for messages, notifications, connections, Square, and Voice.
- Voice Room participant grid with profile tiles, host/moderator/speaker/raised-hand state, and missing-photo fallback.
- Voice Room control bar with Mute/Unmute, Participants, deferred Room Chat, Raise Hand, More, and Leave/End.
- Server-backed Voice Room actions for raise hand, approve/reject speaker, promote/demote moderator, remove participant, lock/unlock room, leave, and end room.
- Participant profile drawer inside Voice Rooms with View Profile, Report, and Block.

### Behavior Changes

- Profile completion requirement for basic beta access is reduced to a basic-ready threshold while 80%+ remains encouraged.
- Discovery uses gender and age as free filters, with advanced filters visible but locked behind Premium.
- Liked/passed profiles are hidden from immediate rediscovery, with a default 90-day rediscovery period.
- Notifications no longer use message/conversation notifications as primary navigation; Chats owns message activity.
- Square feed is ranked by lightweight engagement/freshness/relevance signals instead of plain chronological order.
- Square homepage is simplified by removing the large Trending Discussions section.
- Connections is simplified by removing redundant People I Liked and Matches sections.
- Chat date formatting is made more familiar and less technical.

### Bug Fixes

- Profile image delivery is safer through `SafeStorageImage`, avoiding broken optimizer behavior for protected or signed storage URLs.
- Square comment like handling uses optimistic updates with rollback and avoids double-counting after server response.
- Voice Room removed participants cannot immediately rejoin the same room.

### Technical/Internal Improvements

- Server-side identity locking for display name, gender, and date of birth after onboarding.
- Server-sent realtime invalidation route with cleanup/unsubscribe behavior.
- Notification filtering and non-message unread badge logic.
- Voice Room action schema and server-side permission enforcement.
- Updated integration contract for discovery eligibility.

## Migrations

### `20260709000000_trial_improvements.sql`

Changes:

- Adds `profiles.gender`.
- Adds `onboarding_answers.gender`.
- Adds `profiles_gender_discovery_idx`.
- Creates/updates `supabase_realtime` publication membership for:
  - `conversation_members`
  - `conversations`
  - `message_reads`
  - `messages`
  - `notifications`
  - `saved_profiles`
  - `square_comment_likes`
  - `square_comments`
  - `square_likes`
  - `square_posts`
  - `square_reposts`

Compatibility:

- Additive columns are nullable.
- Realtime publication changes are additive.
- Old code should remain compatible.

Risk:

- Publication changes should be verified in Supabase after applying.

### `20260710000000_trial_ux_refinement.sql`

Changes:

- Replaces `notifications_type_check` to allow Square notification types.
- Replaces `notifications_entity_type_check` to allow `square_post` and `square_comment`.
- Adds `notifications_type_recipient_created_idx`.

Compatibility:

- Existing notification rows remain valid if their types are in the expanded list.
- Old code should tolerate additional notification types if it does not hard-fail on unknown values.

Risk:

- Constraint replacement should be applied before code creates Square notification rows.

### `20260710010000_trial_ux_phase2_discovery_notifications.sql`

Changes:

- Adds `saved_profiles.rediscover_after`.
- Backfills `rediscover_after` with `created_at + interval '90 days'`.
- Adds `saved_profiles_rediscover_after_idx`.
- Replaces notification type/entity check constraints to include:
  - `system_announcement`
  - `feature_update`
  - `account_security`
  - `system`
- Adds `notifications_recipient_non_message_unread_idx`.

Compatibility:

- Mostly additive.
- Backfill rewrites `saved_profiles.rediscover_after` only where null.
- Old code should ignore the nullable column.

Risk:

- Backfill can affect a large `saved_profiles` table; apply during a quiet window if table size has grown.

### `20260713000000_voice_rooms_square_ux.sql`

Changes:

- Adds `voice_rooms.locked_at`.
- Adds `voice_room_participants.hand_raised_at`.
- Adds `voice_room_participants.speaking_since`.
- Adds `voice_room_participants.removed_at`.
- Replaces `voice_room_participants_role_check` to include `moderator`.
- Adds:
  - `voice_rooms_status_public_live_idx`
  - `voice_room_participants_room_role_idx`
  - `voice_room_participants_hand_raised_idx`

Compatibility:

- New columns are nullable.
- Constraint replacement broadens allowed roles.
- Existing production code should remain compatible until `moderator` rows are created.

Risk:

- Must apply before deploying new Voice Room code.
- Rollback needs to convert `moderator` rows back to `listener` before restoring the previous constraint.

## Security Review

Authentication and route protection:

- New API routes use existing Clerk/owned-profile context helpers.
- `src/proxy.ts` is updated to include realtime API protection.
- Voice Room actions use `getVoiceSessionContext`.

Ownership:

- Profile photo replace/delete/reorder is scoped to the signed-in owned profile.
- Public profile preview avoids exposing internal account fields.
- Voice Room target IDs are checked server-side against actual room participants.

Privacy and blocking:

- Square hide/block/report controls continue using existing protected APIs.
- Participant profile drawer links to existing public profile access rules.
- The branch does not intentionally weaken profile privacy, blocking, reporting, or moderation.

Realtime:

- Realtime endpoint sends invalidation events, not full private row payloads.
- Message invalidations are scoped by conversation membership lookup.
- Square and Voice invalidations are broader event triggers, but clients refetch through authorized APIs.

Identity locking:

- Display name, gender, and birthdate become locked after onboarding.
- Server-side checks are added to prevent client bypass.

Potential concerns:

- Ensure Supabase realtime publication membership is correctly applied before relying on realtime behavior.
- Because Square invalidation is broad, it may cause harmless extra refetching; it should not expose row data directly.
- Voice Room moderator role must not be created before migration is applied.

## Rollback Review

Application rollback:

- Keep `main` commit `4bc4dfb426219e841512709e3ef0912c0be4d2eb` as the rollback reference.
- In Vercel, redeploy the previous production deployment or revert the merge commit.

Database rollback:

- Prefer leaving additive nullable columns in place during an app rollback unless they actively cause issues.
- A rollback script has been created locally for the Voice migration: `VOICE_ROOMS_SQUARE_UX_ROLLBACK.sql`.
- That rollback script is currently untracked and not part of this feature branch comparison.

Voice migration rollback order:

1. Drop `voice_room_participants_hand_raised_idx`.
2. Drop `voice_room_participants_room_role_idx`.
3. Drop `voice_rooms_status_public_live_idx`.
4. Convert any `moderator` rows to `listener`.
5. Restore previous `voice_room_participants_role_check`.
6. Drop `hand_raised_at`, `speaking_since`, `removed_at`.
7. Drop `locked_at`.

Trial migration rollback considerations:

- `profiles.gender` and `onboarding_answers.gender` are nullable and can usually remain after app rollback.
- `saved_profiles.rediscover_after` is nullable but backfilled; removing it would lose rediscovery timing data.
- Notification constraint rollbacks require verifying no rows exist with newer notification types before restoring older constraints.
- Realtime publication changes can be left in place unless they cause operational issues.

## Deployment Checklist

Before merge:

- Confirm no uncommitted application code changes are present.
- Confirm `VOICE_ROOMS_SQUARE_UX_ROLLBACK.sql` is intentionally untracked or decide whether to track it separately.
- Confirm AI, Premium, and Payments flags remain disabled in production.
- Review Vercel Preview for `feature/voice-rooms-square-ux`.

Migration order:

1. `20260709000000_trial_improvements.sql`
2. `20260710000000_trial_ux_refinement.sql`
3. `20260710010000_trial_ux_phase2_discovery_notifications.sql`
4. `20260713000000_voice_rooms_square_ux.sql`

Deploy:

1. Apply migrations in order.
2. Confirm migration success in Supabase.
3. Merge feature branch into `main`.
4. Let Vercel deploy production.
5. Run production smoke tests.

Smoke-test checklist:

- Sign in and beta invite access.
- Complete onboarding with gender and photo upload.
- Replace, delete, reorder, and upload multiple profile photos.
- Open People, use free filters, Like, Pass, and View Profile.
- Confirm liked/passed users disappear from immediate discovery.
- Trigger mutual like and confirm conversation appears in Chats.
- Send messages and confirm unread/chats update.
- Open Notifications and confirm non-message activity appears correctly.
- Create Square post, comment, reply, like, repost, report, hide, and block.
- Open Square media viewer.
- Create public/private/scheduled Voice Room.
- Join Voice Room with second account.
- Raise hand, approve/reject, promote/demote moderator, remove participant, lock/unlock, end room.
- Confirm removed Voice participant cannot immediately rejoin.
- Confirm mobile layouts for People, Square, Chats, Voice, Profile Edit.

Monitoring after deploy:

- Vercel build/runtime logs.
- `/api/health`.
- Supabase logs for migration/runtime errors.
- Realtime endpoint errors or high connection churn.
- Profile photo upload/storage errors.
- Square comment and notification errors.
- Voice Room action errors, especially role constraint failures.

## Regression Risks

### High

- Missing migrations before deployment.
  - Cause: new code depends on columns/constraints added in four migrations.
  - Impact: profile, discovery, realtime, notifications, and Voice Room actions can fail.
  - Mitigation: apply migrations in order before production smoke testing.

- Voice Room role rollback after moderator rows exist.
  - Cause: old constraint does not allow `moderator`.
  - Impact: rollback can fail unless moderators are converted.
  - Mitigation: use rollback order documented above.

### Medium

- Realtime behavior depends on Supabase publication membership.
  - Impact: app still works through refetch/fallback patterns, but realtime may feel stale.
  - Mitigation: verify `supabase_realtime` publication includes required tables.

- Identity locking can surprise existing users.
  - Impact: users may be unable to edit display name/gender/date of birth after onboarding.
  - Mitigation: ensure support/admin correction workflow is documented.

- Profile image fallback can hide underlying stale storage data.
  - Impact: user sees fallback instead of broken image; cleanup may still be needed.
  - Mitigation: monitor image fallback frequency and inspect `profile_photos` paths.

- Square broad invalidation can cause extra refetches.
  - Impact: possible increased API/database traffic on active Square sessions.
  - Mitigation: monitor logs and optimize with scoped events if needed.

- Backfill on `saved_profiles.rediscover_after`.
  - Impact: migration can take longer on a large table.
  - Mitigation: apply during a quiet beta window.

### Low

- Documentation/report files add repository noise.
- Chat date copy changes may need user feedback.
- Connections simplification may require onboarding copy or tester guidance.

## Final Recommendation

**GO WITH CONDITIONS**

The branch is suitable for pre-merge beta testing if the migrations are applied in order and the production smoke-test checklist is completed with two accounts. The most important operational dependency is applying the Voice migration before deploying the Voice Room action code. The most important rollback dependency is converting any `moderator` rows to `listener` before restoring the old Voice participant role constraint.
