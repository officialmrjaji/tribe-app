# Square Feed Spec

## Product Purpose

Square is TribeApp's community layer: a calm, personality-first feed where users can share thoughts, ask questions, discover local conversations, and build lightweight familiarity before or after direct matching.

The goal is not to maximize viral attention. The goal is to help users understand how people think, what they care about, and whether there is enough social context to start a meaningful connection.

Square should support:

- Low-pressure self-expression.
- Discovery through interests and shared context.
- Community trust before direct messaging.
- Safer introductions between people who are not matched yet.
- Better matching signals based on what users engage with.

## How Square Differs

### Twitter/X

Square should not be a high-speed public broadcast feed. It should avoid outrage loops, follower clout, quote-dunking, and algorithmic conflict. Posts should feel thoughtful, local, interest-based, and useful for social discovery.

### Reddit

Square should not be anonymous-first forum culture. It can support anonymous thoughts, but identity, safety, and profile context still matter. Topics should help organize discussions, but the product should avoid heavy subreddit-style fragmentation in v1.

### Instagram

Square should not be image-performance social media. Photos can exist, but the feed should not reward polished lifestyle posting over personality, questions, and shared interests.

### Dating Feeds

Square should not become a swipe-adjacent thirst feed. It should not rank users mainly by attractiveness, flirting, or popularity. The feed should create context for better discovery and matching, not replace profiles or turn every post into a dating signal.

## Post Types

### Thoughts

Short text posts for opinions, reflections, observations, and conversation starters.

Recommended MVP fields:

- Body text.
- Topic tags.
- Optional visibility setting.
- Optional location context at city level.

### Photos

Photo posts for activities, places, moments, or recommendations.

Recommended MVP fields:

- Image URL.
- Caption.
- Alt text.
- Topic tags.
- Optional location context at city level.

Photo posts should use the same media safety posture as profile photos, with file type and size limits.

### Questions

Prompt-style posts designed to invite replies.

Examples:

- "Where do creative people hang out in Lagos on weekends?"
- "What is a green flag in a new friendship?"
- "What local activity is underrated?"

Questions should be easy to filter and should be eligible for trending discussions.

### Anonymous Thoughts

Anonymous posts allow users to share softer, vulnerable, or socially sensitive thoughts without attaching the post publicly to their profile.

Anonymous posts are not anonymous to moderation systems. The app must retain the author ID server-side for abuse review, rate limits, reports, and enforcement.

### Polls

Polls help create lightweight participation.

Recommended MVP fields:

- Question.
- 2 to 4 options.
- Single choice only for v1.
- Poll close time.
- Anonymous vote totals.

### Recommendations

Posts for recommending places, activities, communities, books, events, restaurants, tools, or conversation prompts.

Recommendation posts should connect naturally to discovery by revealing lifestyle, intent, interests, and availability.

## Likes

Likes should be a lightweight appreciation signal, not the main ranking mechanic.

Recommended behavior:

- One like per user per post.
- Users can unlike.
- Like count can be visible.
- Avoid aggressive like notifications in v1.
- Use likes as a weak matching signal only.

## Comments

Comments are the primary conversation layer.

Recommended behavior:

- Text-only comments in v1.
- One-level replies only, or flat comments for MVP.
- Author can delete their own comment.
- Post author can hide comments from their own post.
- Report action available on every comment.
- Comments by blocked users are hidden.

Avoid deep nested threads in v1. They increase moderation and UI complexity.

## Reposts

Reposts should be cautious and low-pressure.

Recommended v1 behavior:

- Repost with optional comment.
- No quote-dunking culture.
- Users can delete their own repost.
- Anonymous posts cannot be reposted by default.
- Reposts should preserve original attribution unless the original is anonymous.

If moderation load is high, defer reposts until after MVP.

## Mentions

Square should support mentions using username or in-app ID.

Recommended behavior:

- `@username` for public-friendly mentions.
- Store mentions using stable internal user IDs.
- Display current username at render time.
- Notify mentioned users unless they muted the author or post.
- Do not allow mentioning blocked users.
- Rate limit mentions to reduce spam.

Usernames should be unique, editable with limits, and protected against impersonation.

## Hashtags Or Topics

Use topics instead of pure hashtag chaos.

Recommended approach:

- Allow users to add topic tags.
- Normalize tags to lowercase slugs.
- Support simple hashtag entry such as `#lagosweekend`, but map it to structured topics.
- Maintain a curated topic list for launch.
- Allow emerging topics to trend after moderation review or safety checks.

Example topics:

- `friendship`
- `networking`
- `dating-intent`
- `weekend-plans`
- `lagos`
- `books`
- `fitness`
- `language-exchange`
- `creative-life`
- `food-spots`

## Trending Discussions

Trending should highlight useful conversations, not outrage.

Ranking signals:

- Recent comment activity.
- Unique participants.
- Saves/bookmarks if added later.
- Topic relevance.
- Report rate penalty.
- Block/mute penalty.
- New-user safety penalty for suspicious activity.

Trending should exclude:

- Posts with high report velocity.
- Posts from users under moderation review.
- Anonymous posts until they pass safety thresholds.
- Posts with harassment, sexual solicitation, hate, spam, or private information.

## Moderation Requirements

Moderation must be built into Square from the beginning.

Required controls:

- Report post.
- Report comment.
- Block user.
- Mute user.
- Hide post.
- Delete own post.
- Delete own comment.
- Admin review queue.
- Moderation status for posts and comments.
- Rate limits for posting, commenting, liking, reposting, mentions, and anonymous posts.
- Server-side ownership checks.
- Server-side block enforcement.

Moderation statuses:

- `active`
- `hidden`
- `under_review`
- `removed`
- `author_deleted`

Policy areas:

- Harassment.
- Hate or identity-based attacks.
- Sexual solicitation.
- Spam.
- Scams.
- Impersonation.
- Doxxing or private information.
- Minors and safety-sensitive content.
- Self-harm or crisis content.
- Illegal activity.

## Anonymous Post Safety Rules

Anonymous posting should be treated as a safety-sensitive feature.

Rules:

- Anonymous author ID is hidden from users but stored in the database.
- Anonymous posts must be rate limited more strictly than normal posts.
- Anonymous comments should not be included in v1 unless moderation capacity exists.
- Anonymous posts cannot mention other users in v1.
- Anonymous posts cannot include photos in v1.
- Anonymous posts cannot be reposted in v1.
- Anonymous posts should not appear in trending until reviewed or trusted by safety signals.
- Users with recent moderation violations cannot post anonymously.
- Blocked users should not be able to use anonymity to reach people who blocked them.
- Anonymous post reports must reveal the author to admins.

Recommended anonymous limits:

- 1 to 2 anonymous posts per day.
- No external links.
- Text-only.
- Minimum account age or profile completeness requirement.

## Database Tables Needed

### square_posts

- `id`
- `author_user_id`
- `author_profile_id`
- `post_type`
- `body`
- `caption`
- `image_url`
- `image_storage_path`
- `is_anonymous`
- `visibility`
- `city`
- `status`
- `like_count`
- `comment_count`
- `repost_count`
- `created_at`
- `updated_at`
- `deleted_at`

### square_comments

- `id`
- `post_id`
- `author_user_id`
- `author_profile_id`
- `body`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

### square_likes

- `post_id`
- `user_id`
- `created_at`

Primary key: `post_id`, `user_id`.

### square_reposts

- `id`
- `post_id`
- `user_id`
- `profile_id`
- `commentary`
- `created_at`
- `deleted_at`

### square_mentions

- `id`
- `post_id`
- `comment_id`
- `mentioned_user_id`
- `mentioned_by_user_id`
- `created_at`

### square_topics

- `id`
- `name`
- `slug`
- `description`
- `status`
- `created_at`

### square_post_topics

- `post_id`
- `topic_id`
- `created_at`

Primary key: `post_id`, `topic_id`.

### square_polls

- `id`
- `post_id`
- `question`
- `closes_at`
- `created_at`

### square_poll_options

- `id`
- `poll_id`
- `body`
- `sort_order`
- `created_at`

### square_poll_votes

- `poll_id`
- `option_id`
- `user_id`
- `created_at`

Primary key: `poll_id`, `user_id`.

### square_reports

- `id`
- `reporter_user_id`
- `post_id`
- `comment_id`
- `reported_user_id`
- `reason`
- `details`
- `status`
- `created_at`
- `updated_at`

### square_mutes

- `muter_user_id`
- `muted_user_id`
- `created_at`

Primary key: `muter_user_id`, `muted_user_id`.

## API Routes Needed

### Feed

- `GET /api/square/feed`
- `GET /api/square/trending`
- `GET /api/square/topics`
- `GET /api/square/topics/[slug]`

### Posts

- `POST /api/square/posts`
- `GET /api/square/posts/[postId]`
- `PATCH /api/square/posts/[postId]`
- `DELETE /api/square/posts/[postId]`
- `POST /api/square/posts/[postId]/report`

### Engagement

- `POST /api/square/posts/[postId]/like`
- `DELETE /api/square/posts/[postId]/like`
- `POST /api/square/posts/[postId]/repost`
- `DELETE /api/square/reposts/[repostId]`

### Comments

- `GET /api/square/posts/[postId]/comments`
- `POST /api/square/posts/[postId]/comments`
- `DELETE /api/square/comments/[commentId]`
- `POST /api/square/comments/[commentId]/report`

### Polls

- `POST /api/square/posts/[postId]/poll/vote`

### Safety

- `POST /api/square/users/[userId]/mute`
- `DELETE /api/square/users/[userId]/mute`

## UI Pages And Components Needed

### Pages

- `/square`
- `/square/trending`
- `/square/topics/[slug]`
- `/square/posts/[postId]`
- `/square/create`

### Components

- `SquareFeed`
- `SquarePostCard`
- `SquareComposer`
- `PostTypeSelector`
- `TopicPicker`
- `AnonymousToggle`
- `PollBuilder`
- `CommentList`
- `CommentComposer`
- `LikeButton`
- `RepostButton`
- `MentionInput`
- `TrendingTopics`
- `ReportPostDialog`
- `ReportCommentDialog`
- `FeedEmptyState`
- `FeedLoadingState`
- `ModerationStatusBanner`

Navigation should place Square near Discovery and Messages, but it should not visually dominate the app.

## MVP Scope

Recommended v1:

- Square feed page.
- Create text thoughts.
- Create questions.
- Create recommendation posts.
- Add one photo to a photo post.
- Add topics.
- Like posts.
- Comment on posts.
- Mention users.
- Report posts and comments.
- Hide blocked or muted users.
- Basic trending discussions.
- Anonymous text-only thoughts with strict limits.
- Connect Square posts to profile pages.

Defer complex content ranking. Start with recency plus lightweight relevance and safety filters.

## Features To Avoid In V1

Avoid:

- Infinite nested comments.
- Public follower counts.
- Quote-post dunking.
- Public like leaderboards.
- View counts.
- Video posts.
- Audio posts.
- Anonymous comments.
- Anonymous photos.
- Direct monetization of post reach.
- Open external links.
- AI-generated posts.
- Algorithmic controversy ranking.
- Heavy subreddit-style community creation.
- Public dating-intent labels on every post.

These features increase moderation complexity and can pull the product away from personality-first discovery.

## How Square Connects Back To Discovery And Matching

Square should strengthen discovery without replacing it.

Connection points:

- Show recent public Square activity on profiles if user allows it.
- Use topic engagement as a weak recommendation signal.
- Use thoughtful comments as social context in discovery.
- Let users open a profile from a post or comment.
- Add "Because you both engage with this topic" as a match reason later.
- Allow users to save a profile from Square, subject to existing save limits and safety checks.
- Hide Square content from blocked users.
- Respect incognito mode if premium adds it later.

Square signals should never override explicit safety settings, blocks, visibility, or profile quality requirements.

## Risks And Safeguards

### Risk: Feed Becomes Noisy Or Performative

Safeguards:

- Avoid follower counts and viral metrics in v1.
- Keep topics curated.
- Use calm ranking and thoughtful empty states.

### Risk: Anonymous Posting Enables Abuse

Safeguards:

- Store author IDs server-side.
- Rate limit anonymous posts.
- Disable anonymous mentions, photos, and reposts.
- Add report and review flows.

### Risk: Moderation Load Grows Quickly

Safeguards:

- Start with fewer post types.
- Add admin review queues before public launch.
- Create clear moderation statuses.
- Rate limit high-risk actions.

### Risk: Square Competes With Discovery

Safeguards:

- Keep profile discovery as the main matching path.
- Use Square as context, not as a replacement for matching.
- Do not make Square feel like a popularity contest.

### Risk: Safety And Privacy Confusion

Safeguards:

- Make anonymous behavior clear.
- Keep visibility controls understandable.
- Respect blocks and mutes everywhere.
- Do not expose private profile fields through feed APIs.

## Recommendation

Build Square after the core discovery, matching, messaging, and safety flows are stable. For v1, ship a restrained community feed with text thoughts, questions, recommendations, one-photo posts, comments, likes, mentions, topics, basic trending, and tightly controlled anonymous thoughts. Avoid public clout mechanics, complex repost culture, video, anonymous comments, and monetized reach until TribeApp has stronger moderation capacity and user density.
