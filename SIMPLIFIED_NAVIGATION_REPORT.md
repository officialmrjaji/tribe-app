# Simplified Navigation Report

## What Changed

- Replaced the busy page-level navigation model with one shared primary navigation frame.
- Desktop sidebar now shows only five primary destinations:
  - People
  - Connections
  - Chats
  - Square
  - Me
- Mobile bottom navigation now shows the same five destinations.
- Moved Notifications out of primary navigation into a persistent bell icon in the top-right.
- Added a Chats unread badge to the shared navigation.
- Removed Premium, AI Coach, Voice Rooms, Settings, Safety, Notifications, and Profile from primary navigation.
- Added a new Me hub with contextual entry cards for:
  - Profile
  - AI Coach
  - Premium
  - Voice Intro
  - Settings
  - Safety Center
  - Notifications
  - Subscription
  - Sign out
- Simplified the People page by removing the old eleven-item sidebar and adding contextual cards for:
  - People filters
  - Voice Rooms / voice-first matching
- Standardized visible labels:
  - Discover / Discovery -> People
  - Messages -> Chats
  - Profile primary nav -> Me

## Routes Updated

- `/` remains the People experience.
- `/discover` now redirects to `/`.
- `/explore` remains the Connections hub.
- `/messages` remains the Chats route.
- `/profile` now redirects to `/me`.
- `/profile/edit` remains the profile editing route and is active under Me.
- `/settings`, `/safety`, `/premium`, `/premium/manage`, and `/ai` remain working routes and are active under Me.
- `/voice` remains the Voice Rooms route and is active under People.
- `/notifications` remains available through the bell icon.

## Backward Compatibility Notes

- Existing API routes were not changed.
- Existing feature routes remain available.
- Existing saved/passed compatibility routes still work and remain active under Connections.
- Existing `/messages` links still work, but user-facing copy now says Chats.
- Existing `/explore` links still work, but the page is positioned as Connections.

## Files Changed

- `src/app/admin/page.tsx`
- `src/app/ai/ai-companion-client.tsx`
- `src/app/discover/page.tsx`
- `src/app/explore/page.tsx`
- `src/app/layout.tsx`
- `src/app/me/page.tsx`
- `src/app/messages/[conversationId]/conversation-thread.tsx`
- `src/app/messages/messages-inbox.tsx`
- `src/app/not-found.tsx`
- `src/app/notifications/notifications-page.tsx`
- `src/app/onboarding/onboarding-flow.tsx`
- `src/app/page.tsx`
- `src/app/premium/upgrade-client.tsx`
- `src/app/profile/page.tsx`
- `src/app/profile/edit/profile-editor.tsx`
- `src/app/settings/page.tsx`
- `src/app/voice/voice-home-client.tsx`
- `src/components/discovery/profile-collection-grid.tsx`
- `src/components/discovery/profile-collection-page.tsx`
- `src/components/navigation/navigation-frame.tsx`
- `src/components/square/square-feed.tsx`

## Verification

- `npm run lint` passed.
- `npm run build` passed.

## Deferred UX Improvements

- Connections liked-you count is not shown in the primary navigation because the available count is currently computed by the Connections page server logic.
- The Notifications bell currently opens the existing notifications page rather than a dropdown.
- A future pass could add route-level loading skeletons for the new Me hub and any slow secondary pages.
