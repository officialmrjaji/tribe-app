# Release 1.5 Square Community Feed Report

## Summary

Release 1.5 adds the MVP Square community feed from `SQUARE_FEED_SPEC.md`. Square is implemented as a calm, personality-first community layer for thoughts, questions, recommendations, photo posts, polls, comments, likes, reposts, topics, mentions, and profile-linked conversation context.

## Implemented

- Added `/square` feed page.
- Added `/square/create` post composer.
- Added `/square/trending` trending discussions page.
- Added `/square/topics/[slug]` topic feed pages.
- Added `/square/posts/[postId]` post detail and comments page.
- Added `/profiles/[profileId]` lightweight public profile pages linked from Square authors.
- Added thought, photo, question, anonymous thought, poll, and recommendation post types.
- Added one-photo Square posts through the `square-media` Supabase bucket.
- Added likes and unlike support.
- Added comments.
- Added repost support with safeguards.
- Added mention parsing using `@display-name-slug`, `@profile-id`, or `@user-id` matching.
- Added hashtag/topic parsing and structured Square topics.
- Added trending topic summaries.
- Added post and comment reporting.
- Added Square mute controls.
- Added protected route coverage for `/square`, `/profiles`, and `/api/square`.
- Added Square navigation entry to the existing discovery sidebar.

## Database

Created migration:

- `supabase/migrations/20260630010000_release1_5_square_feed.sql`

Tables added:

- `square_posts`
- `square_comments`
- `square_likes`
- `square_reposts`
- `square_mentions`
- `square_topics`
- `square_post_topics`
- `square_polls`
- `square_poll_options`
- `square_poll_votes`
- `square_reports`
- `square_mutes`

Storage added:

- `square-media` public bucket for JPEG, PNG, and WebP photo posts.

## Safety And Moderation

- Anonymous posts are text-only.
- Anonymous posts cannot include photos.
- Anonymous posts cannot mention other members.
- Anonymous posts are rate-limited separately.
- Reposting anonymous posts is blocked.
- Users cannot repost their own posts.
- Blocked and muted users are filtered out of Square feed results.
- Mentioning blocked or muted users is rejected.
- Post, comment, and anonymous posting rate limits are enforced server-side.
- Reports are stored for posts and comments.
- Client-submitted author IDs are never trusted.

## MVP Limits

- No stories.
- No live streaming.
- No AI.
- No video posts.
- No audio posts.
- No anonymous comments.
- No nested comments.
- No follower counts.
- No public like leaderboards.
- No realtime feed updates.
- Post editing is intentionally not included in MVP.
- Repost deletion API exists, but the MVP UI only creates reposts.

## Validation

- `npm run lint` passed.
- `npm run build` passed.

## Files Changed

- `RELEASE1_5_SQUARE_REPORT.md`
- `supabase/migrations/20260630010000_release1_5_square_feed.sql`
- `src/app/api/square/comments/[commentId]/route.ts`
- `src/app/api/square/comments/[commentId]/report/route.ts`
- `src/app/api/square/feed/route.ts`
- `src/app/api/square/posts/route.ts`
- `src/app/api/square/posts/[postId]/route.ts`
- `src/app/api/square/posts/[postId]/comments/route.ts`
- `src/app/api/square/posts/[postId]/like/route.ts`
- `src/app/api/square/posts/[postId]/poll/vote/route.ts`
- `src/app/api/square/posts/[postId]/report/route.ts`
- `src/app/api/square/posts/[postId]/repost/route.ts`
- `src/app/api/square/reposts/[repostId]/route.ts`
- `src/app/api/square/topics/route.ts`
- `src/app/api/square/topics/[slug]/route.ts`
- `src/app/api/square/trending/route.ts`
- `src/app/api/square/users/[userId]/mute/route.ts`
- `src/app/profiles/[profileId]/page.tsx`
- `src/app/square/page.tsx`
- `src/app/square/create/page.tsx`
- `src/app/square/posts/[postId]/page.tsx`
- `src/app/square/topics/[slug]/page.tsx`
- `src/app/square/trending/page.tsx`
- `src/components/square/square-composer.tsx`
- `src/components/square/square-feed.tsx`
- `src/components/square/square-thread.tsx`
- `src/lib/square/api.ts`
- `src/lib/square/schema.ts`
- `src/lib/square/service.ts`
- `src/app/page.tsx`
- `src/proxy.ts`

## Testing Note

Apply the new Supabase migration manually before testing Square against the live database. The Square pages and API routes require the new tables and the `square-media` storage bucket.
