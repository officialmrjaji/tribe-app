# Profile Quality Requirement Report

## Summary

Implemented the current improvement requiring users to upload at least 3 profile photos before discovery participation and messaging progression.

## What Changed

- Added a shared minimum discovery photo requirement of 3 uploaded profile photos.
- Updated profile completeness so the photo checklist item only completes when 3 uploaded photos exist.
- Capped profile completeness below 80% when the user has fewer than 3 uploaded photos.
- Added clear checklist and sidebar messaging: "Upload at least 3 photos to unlock discovery."
- Updated discovery access to gate users with fewer than 3 photos and redirect them to `/profile/edit`.
- Updated recommendation eligibility so candidates must have at least 3 uploaded profile photos.
- Updated save/like behavior so users with fewer than 3 photos cannot save profiles.
- Updated conversation creation so both participants must satisfy the 3-photo requirement before messaging can open.

## Files Changed

- `src/lib/profile/service.ts`
- `src/app/api/discover/route.ts`
- `src/lib/discovery/service.ts`
- `src/app/api/profile/save/route.ts`
- `src/lib/messaging/service.ts`
- `src/app/profile/edit/profile-editor.tsx`
- `PROFILE_QUALITY_REQUIREMENT_REPORT.md`

## Product Behavior

- Users below the 3-photo threshold are directed to profile editing before discovery.
- Users below the 3-photo threshold cannot save/like other profiles.
- Profiles below the 3-photo threshold do not appear in recommendation results.
- Conversations cannot be created unless both users have at least 3 uploaded profile photos.
- Existing privacy and authentication checks remain intact.

## Validation

- `npm run lint` passed.
- `npm run build` passed.

## Notes

- This change does not add monetization, community feeds, or AI.
- Existing users with fewer than 3 uploaded photos may see their profile completeness drop below 80% until they add more photos.
- Clerk avatar images no longer satisfy the photo requirement; the rule is based on uploaded `profile_photos` records.
