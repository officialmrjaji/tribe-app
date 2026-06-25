# Discoverability Fix

## Summary

This update makes newly onboarded users discoverable by default while preserving existing users' saved profile visibility settings.

## What Changed

- First-time onboarding completion now updates the user's profile with:
  - `visibility = discoverable`
  - `discoverable = true`
- The profile editor now exposes:
  - A `Discoverable` On/Off toggle.
  - A visibility selector with `Discoverable`, `Members only`, and `Private`.
- Discovery recommendations now require profiles to be both:
  - `discoverable = true`
  - `visibility != private`

## Existing User Behavior

Existing completed users keep their current profile settings. The onboarding save path only applies the default discoverability values when the profile did not already have `onboarding_completed_at` set.

## Testing

- `npm.cmd run lint`
- `npm.cmd run build`

Both checks passed.

## Notes

The existing two test profiles were already updated directly in Supabase for testing. This code change affects future users when they complete onboarding.
