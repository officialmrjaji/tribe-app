# Media Upload Fix

## Summary

Profile photo and voice introduction uploads now use the `profile-media` Supabase bucket through protected server routes. Uploads remain owner-scoped because the client never writes directly to Supabase Storage; authenticated API routes resolve the current Clerk user, load the owned profile, and store media under that user's Supabase account/profile path.

## What Changed

- Added explicit validation for profile photos and voice introductions.
- Added clear upload errors for missing files, invalid multipart requests, unsupported MIME types, empty files, oversized files, invalid voice duration, bucket configuration failures, storage upload failures, and database write failures.
- Ensured the `profile-media` bucket exists and is configured for public profile media with the expected MIME types and 10 MB file limit.
- Changed storage paths to include both owner user ID and profile ID:
  - `users/{user_id}/profiles/{profile_id}/photos/{file_id}.{ext}`
  - `users/{user_id}/profiles/{profile_id}/voice/{file_id}.{ext}`
- Converted uploaded files to `ArrayBuffer` before Supabase upload for more predictable server-side storage handling.
- Cleaned up newly uploaded storage objects if the related profile database write fails.

## Security Notes

- Upload routes remain protected by Clerk middleware.
- Ownership is enforced server-side through `getCurrentOwnedProfile`.
- The client cannot choose a target profile ID or storage path.
- Supabase public URLs are only produced after server-side validation and storage upload.
- No direct browser Supabase Storage writes were added.

## Verification

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

## Remaining Setup Requirement

The Supabase project must still have the Phase 3.8 migration applied, or the server key must be able to create/update the `profile-media` bucket at runtime.
