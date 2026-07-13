import {
  getProfileVerification,
  type OwnedProfile,
  type ProfileVerification,
} from "@/lib/profile/service";
import { createNotification } from "@/lib/notifications/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  SquareCommentEditInput,
  SquarePostEditInput,
  SquarePostInput,
  SquarePostType,
} from "./schema";

const squareMediaBucket = "square-media";
const squareMediaMaxBytes = 10 * 1024 * 1024;
const squareImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const squareImageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const postWindowMs = 24 * 60 * 60 * 1000;
const maxPostsPerWindow = 12;
const maxAnonymousPostsPerWindow = 2;
const commentWindowMs = 60 * 60 * 1000;
const maxCommentsPerWindow = 30;

export class SquareError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SquareError";
    this.status = status;
  }
}

type SquarePostRow = {
  author_profile_id: string;
  author_user_id: string;
  body: string | null;
  caption: string | null;
  city: string | null;
  comment_count: number;
  created_at: string;
  deleted_at: string | null;
  id: string;
  edited_at?: string | null;
  image_storage_path: string | null;
  image_url: string | null;
  is_anonymous: boolean;
  like_count: number;
  post_type: SquarePostType;
  repost_count: number;
  status: string;
  updated_at: string;
  visibility: string;
};

type SquareCommentRow = {
  author_profile_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  edited_at?: string | null;
  id: string;
  like_count?: number;
  parent_comment_id?: string | null;
  post_id: string;
  status: string;
  updated_at: string;
};

type SquareProfileRow = {
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  display_name: string | null;
  email_verified_at: string | null;
  id: string;
  identity_verified_at: string | null;
  phone_verified_at: string | null;
  region: string | null;
  user_id: string;
  visibility: "discoverable" | "members" | "private";
};

type SquareTopicRow = {
  description: string | null;
  id: string;
  name: string;
  slug: string;
  status: string;
};

type SquarePollRow = {
  closes_at: string | null;
  created_at: string;
  id: string;
  post_id: string;
  question: string;
};

type SquarePollOptionRow = {
  body: string;
  id: string;
  poll_id: string;
  sort_order: number;
};

type SquarePollVoteRow = {
  option_id: string;
  poll_id: string;
  user_id: string;
};

export type SquareAuthor = {
  avatarUrl: string | null;
  city: string;
  name: string;
  profileHref: string | null;
  profileId: string | null;
  userId: string | null;
  verification: ProfileVerification | null;
};

export type SquareTopic = {
  description: string | null;
  id: string;
  name: string;
  slug: string;
};

export type SquarePollOption = {
  body: string;
  id: string;
  isSelected: boolean;
  voteCount: number;
};

export type SquarePoll = {
  closesAt: string | null;
  id: string;
  options: SquarePollOption[];
  question: string;
  totalVotes: number;
};

export type SquarePost = {
  author: SquareAuthor;
  body: string;
  caption: string | null;
  city: string;
  commentCount: number;
  comments: SquareComment[];
  createdAt: string;
  editedAt: string | null;
  hashtags: string[];
  id: string;
  imageUrl: string | null;
  isAnonymous: boolean;
  isLiked: boolean;
  isMine: boolean;
  isReposted: boolean;
  likeCount: number;
  poll: SquarePoll | null;
  postType: SquarePostType;
  repostCount: number;
  topics: SquareTopic[];
};

export type SquareComment = {
  author: SquareAuthor;
  body: string;
  createdAt: string;
  editedAt: string | null;
  id: string;
  isLiked: boolean;
  isMine: boolean;
  likeCount: number;
  parentCommentId: string | null;
};

export type SquareFeedResult = {
  posts: SquarePost[];
  topics: SquareTopic[];
  trendingTopics: SquareTrendingTopic[];
};

export type SquareTrendingTopic = SquareTopic & {
  postCount: number;
};

export async function listSquareFeed({
  ownedProfile,
  topicSlug,
  trendingOnly = false,
}: {
  ownedProfile: OwnedProfile;
  topicSlug?: string;
  trendingOnly?: boolean;
}): Promise<SquareFeedResult> {
  const supabase = createSupabaseAdminClient();
  const hiddenUserIds = await getHiddenSquareUserIds(ownedProfile.account.id);
  let query = supabase
    .from("square_posts")
    .select("*")
    .eq("status", "active")
    .is("deleted_at", null)
    .order(
      trendingOnly ? "comment_count" : "created_at",
      { ascending: false },
    )
    .limit(30);

  if (trendingOnly) {
    query = query.gt("comment_count", 0);
  }

  if (topicSlug) {
    const topic = await getTopicBySlug(topicSlug);

    if (!topic) {
      return {
        posts: [],
        topics: await listSquareTopics(),
        trendingTopics: await listTrendingTopics(),
      };
    }

    const { data: postTopicRows, error: postTopicError } = await supabase
      .from("square_post_topics")
      .select("post_id")
      .eq("topic_id", topic.id)
      .limit(100);

    if (postTopicError) {
      throw postTopicError;
    }

    const postIds = (postTopicRows ?? []).map((row) => row.post_id as string);

    if (postIds.length === 0) {
      return {
        posts: [],
        topics: await listSquareTopics(),
        trendingTopics: await listTrendingTopics(),
      };
    }

    query = query.in("id", postIds);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const visibleRows = ((data ?? []) as SquarePostRow[]).filter(
    (post) => !hiddenUserIds.has(post.author_user_id),
  );

  const hydratedPosts = await hydrateSquarePosts({
    currentUserId: ownedProfile.account.id,
    posts: visibleRows,
  });

  return {
    posts: await attachCommentsToPosts({
      currentUserId: ownedProfile.account.id,
      hiddenUserIds,
      posts: hydratedPosts,
    }),
    topics: await listSquareTopics(),
    trendingTopics: await listTrendingTopics(),
  };
}

export async function getSquarePostThread(
  ownedProfile: OwnedProfile,
  postId: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("square_posts")
    .select("*")
    .eq("id", postId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const post = data as SquarePostRow | null;

  if (!post) {
    throw new SquareError("Square post not found.", 404);
  }

  await assertCanViewSquareUser(ownedProfile.account.id, post.author_user_id);

  const hydratedPost = (
    await hydrateSquarePosts({
      currentUserId: ownedProfile.account.id,
      posts: [post],
    })
  )[0];
  const comments = await listSquareComments(ownedProfile, post.id);

  return {
    comments,
    post: {
      ...hydratedPost,
      comments,
    },
  };
}

export async function createSquarePost({
  imageFile,
  input,
  ownedProfile,
}: {
  imageFile?: File | null;
  input: SquarePostInput;
  ownedProfile: OwnedProfile;
}) {
  const normalizedInput = normalizePostInput(input);
  await assertSquarePostRateLimit({
    isAnonymous: normalizedInput.isAnonymous,
    userId: ownedProfile.account.id,
  });

  if (normalizedInput.isAnonymous) {
    assertAnonymousPostAllowed(normalizedInput, ownedProfile);
  }

  if (normalizedInput.postType === "photo" && !imageFile) {
    throw new SquareError("Photo posts need one image.", 400);
  }

  if (imageFile && normalizedInput.isAnonymous) {
    throw new SquareError("Anonymous posts are text-only.", 400);
  }

  const textForSignals = [normalizedInput.body, normalizedInput.caption]
    .filter(Boolean)
    .join(" ");
  const mentions = extractMentionTokens(textForSignals);

  if (normalizedInput.isAnonymous && mentions.length) {
    throw new SquareError("Anonymous posts cannot mention other members.", 400);
  }

  const supabase = createSupabaseAdminClient();
  await ensureSquareMediaBucket(supabase);
  let uploadedImage:
    | {
        publicUrl: string;
        storagePath: string;
      }
    | null = null;

  if (imageFile) {
    uploadedImage = await uploadSquareImage({
      file: imageFile,
      ownedProfile,
      supabase,
    });
  }

  const now = new Date().toISOString();
  const { data: post, error: postError } = await supabase
    .from("square_posts")
    .insert({
      author_profile_id: ownedProfile.profile.id,
      author_user_id: ownedProfile.account.id,
      body: normalizedInput.body,
      caption: normalizedInput.caption,
      city: ownedProfile.profile.city,
      image_storage_path: uploadedImage?.storagePath ?? null,
      image_url: uploadedImage?.publicUrl ?? null,
      is_anonymous: normalizedInput.isAnonymous,
      post_type: normalizedInput.isAnonymous
        ? "anonymous_thought"
        : normalizedInput.postType,
      updated_at: now,
    })
    .select("*")
    .single();

  if (postError || !post) {
    if (uploadedImage) {
      await removeSquareMediaObjects(supabase, [uploadedImage.storagePath]);
    }

    throw postError ?? new SquareError("Square post could not be created.", 500);
  }

  const postRow = post as SquarePostRow;
  await Promise.all([
    syncPostTopics({
      postId: postRow.id,
      postType: postRow.post_type,
      rawTopics: normalizedInput.topics,
      text: textForSignals,
    }),
    syncPostMentions({
      mentionedByUserId: ownedProfile.account.id,
      postId: postRow.id,
      tokens: mentions,
    }),
    normalizedInput.postType === "poll"
      ? createPollForPost({
          options: normalizedInput.pollOptions ?? [],
          postId: postRow.id,
          question: normalizedInput.pollQuestion ?? normalizedInput.body,
        })
      : Promise.resolve(),
  ]);

  return (
    await hydrateSquarePosts({
      currentUserId: ownedProfile.account.id,
      posts: [postRow],
    })
  )[0];
}

export async function toggleSquareLike({
  liked,
  ownedProfile,
  postId,
}: {
  liked: boolean;
  ownedProfile: OwnedProfile;
  postId: string;
}) {
  const post = await getActivePost(postId);
  await assertCanViewSquareUser(ownedProfile.account.id, post.author_user_id);
  const supabase = createSupabaseAdminClient();

  if (liked) {
    const { error } = await supabase.from("square_likes").upsert(
      {
        post_id: postId,
        user_id: ownedProfile.account.id,
      },
      { onConflict: "post_id,user_id" },
    );

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("square_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", ownedProfile.account.id);

    if (error) {
      throw error;
    }
  }

  const likeCount = await refreshPostCount(postId, "likes");

  if (liked && post.author_user_id !== ownedProfile.account.id) {
    await createNotification({
      actorUserId: ownedProfile.account.id,
      data: {
        postId,
        profileId: ownedProfile.profile.id,
      },
      dedupeKey: `square_like:${postId}:${ownedProfile.account.id}:${post.author_user_id}`,
      entityId: postId,
      entityType: "square_post",
      recipientUserId: post.author_user_id,
      type: "square_like",
    });
  }

  return { liked, likeCount, postId };
}

export async function createSquareComment({
  body,
  ownedProfile,
  parentCommentId,
  postId,
}: {
  body: string;
  ownedProfile: OwnedProfile;
  parentCommentId?: string;
  postId: string;
}) {
  const cleanBody = body.trim();

  if (!cleanBody) {
    throw new SquareError("Comment cannot be empty.", 400);
  }

  await assertSquareCommentRateLimit(ownedProfile.account.id);
  const post = await getActivePost(postId);
  await assertCanViewSquareUser(ownedProfile.account.id, post.author_user_id);

  const supabase = createSupabaseAdminClient();
  let parentComment: SquareCommentRow | null = null;

  if (parentCommentId) {
    parentComment = await getActiveComment(parentCommentId);

    if (parentComment.post_id !== postId) {
      throw new SquareError("Reply target does not belong to this post.", 400);
    }

    await assertCanViewSquareUser(
      ownedProfile.account.id,
      parentComment.author_user_id,
    );
  }

  const { data, error } = await supabase
    .from("square_comments")
    .insert({
      author_profile_id: ownedProfile.profile.id,
      author_user_id: ownedProfile.account.id,
      body: cleanBody,
      parent_comment_id: parentCommentId ?? null,
      post_id: postId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new SquareError("Comment could not be created.", 500);
  }

  await Promise.all([
    refreshPostCount(postId, "comments"),
    syncPostMentions({
      commentId: data.id,
      mentionedByUserId: ownedProfile.account.id,
      postId,
      tokens: extractMentionTokens(cleanBody),
    }),
    createSquareCommentNotifications({
      commentId: data.id,
      ownedProfile,
      parentComment,
      post,
      postId,
    }),
  ]);

  return (
    await hydrateSquareComments({
      comments: [data as SquareCommentRow],
      currentUserId: ownedProfile.account.id,
    })
  )[0];
}

export async function updateSquarePost({
  input,
  ownedProfile,
  postId,
}: {
  input: SquarePostEditInput;
  ownedProfile: OwnedProfile;
  postId: string;
}) {
  const post = await getActivePost(postId);

  if (post.author_user_id !== ownedProfile.account.id) {
    throw new SquareError("You can only edit your own Square posts.", 403);
  }

  const body = input.body?.trim() ?? post.body ?? "";
  const caption = input.caption?.trim() ?? post.caption ?? "";

  if (!body && !caption && !post.image_url) {
    throw new SquareError("Square posts need text or media.", 400);
  }

  const textForSignals = [body, caption].filter(Boolean).join(" ");
  const mentions = extractMentionTokens(textForSignals);

  if (post.is_anonymous && mentions.length) {
    throw new SquareError("Anonymous posts cannot mention other members.", 400);
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("square_posts")
    .update({
      body: body || null,
      caption: caption || null,
      edited_at: now,
      updated_at: now,
    })
    .eq("id", postId)
    .eq("author_user_id", ownedProfile.account.id)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new SquareError("Square post could not be edited.", 500);
  }

  await replacePostTopics({
    postId,
    postType: post.post_type,
    rawTopics: input.topics ?? [],
    text: textForSignals,
  });
  await replaceMentions({
    mentionedByUserId: ownedProfile.account.id,
    postId,
    tokens: mentions,
  });

  return (
    await hydrateSquarePosts({
      currentUserId: ownedProfile.account.id,
      posts: [data as SquarePostRow],
    })
  )[0];
}

export async function updateSquareComment({
  commentId,
  input,
  ownedProfile,
}: {
  commentId: string;
  input: SquareCommentEditInput;
  ownedProfile: OwnedProfile;
}) {
  const comment = await getActiveComment(commentId);

  if (comment.author_user_id !== ownedProfile.account.id) {
    throw new SquareError("You can only edit your own comments.", 403);
  }

  const cleanBody = input.body.trim();

  if (!cleanBody) {
    throw new SquareError("Comment cannot be empty.", 400);
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("square_comments")
    .update({
      body: cleanBody,
      edited_at: now,
      updated_at: now,
    })
    .eq("id", commentId)
    .eq("author_user_id", ownedProfile.account.id)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new SquareError("Comment could not be edited.", 500);
  }

  await replaceMentions({
    commentId,
    mentionedByUserId: ownedProfile.account.id,
    postId: comment.post_id,
    tokens: extractMentionTokens(cleanBody),
  });

  return (
    await hydrateSquareComments({
      comments: [data as SquareCommentRow],
      currentUserId: ownedProfile.account.id,
    })
  )[0];
}

export async function toggleSquareCommentLike({
  commentId,
  liked,
  ownedProfile,
}: {
  commentId: string;
  liked: boolean;
  ownedProfile: OwnedProfile;
}) {
  const comment = await getActiveComment(commentId);
  await assertCanViewSquareUser(ownedProfile.account.id, comment.author_user_id);
  const supabase = createSupabaseAdminClient();

  if (liked) {
    const { error } = await supabase.from("square_comment_likes").upsert(
      {
        comment_id: commentId,
        user_id: ownedProfile.account.id,
      },
      { onConflict: "comment_id,user_id" },
    );

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("square_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", ownedProfile.account.id);

    if (error) {
      throw error;
    }
  }

  const likeCount = await refreshCommentLikeCount(commentId);

  return { commentId, liked, likeCount };
}

export async function deleteSquarePost({
  ownedProfile,
  postId,
}: {
  ownedProfile: OwnedProfile;
  postId: string;
}) {
  const post = await getActivePost(postId);

  if (post.author_user_id !== ownedProfile.account.id) {
    throw new SquareError("You can only delete your own Square posts.", 403);
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("square_posts")
    .update({
      deleted_at: new Date().toISOString(),
      status: "author_deleted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("author_user_id", ownedProfile.account.id);

  if (error) {
    throw error;
  }

  return { deleted: true, postId };
}

export async function deleteSquareComment({
  commentId,
  ownedProfile,
}: {
  commentId: string;
  ownedProfile: OwnedProfile;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: comment, error: readError } = await supabase
    .from("square_comments")
    .select("id, author_user_id, post_id")
    .eq("id", commentId)
    .eq("author_user_id", ownedProfile.account.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!comment) {
    throw new SquareError("Comment not found.", 404);
  }

  const { error } = await supabase
    .from("square_comments")
    .update({
      deleted_at: new Date().toISOString(),
      status: "author_deleted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("author_user_id", ownedProfile.account.id);

  if (error) {
    throw error;
  }

  await refreshPostCount(comment.post_id as string, "comments");

  return { deleted: true, commentId };
}

export async function listSquareComments(
  ownedProfile: OwnedProfile,
  postId: string,
) {
  const supabase = createSupabaseAdminClient();
  const hiddenUserIds = await getHiddenSquareUserIds(ownedProfile.account.id);
  const { data, error } = await supabase
    .from("square_comments")
    .select("*")
    .eq("post_id", postId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(80);

  if (error) {
    throw error;
  }

  const comments = ((data ?? []) as SquareCommentRow[]).filter(
    (comment) => !hiddenUserIds.has(comment.author_user_id),
  );

  return hydrateSquareComments({
    comments,
    currentUserId: ownedProfile.account.id,
  });
}

export async function repostSquarePost({
  commentary,
  ownedProfile,
  postId,
}: {
  commentary?: string;
  ownedProfile: OwnedProfile;
  postId: string;
}) {
  const post = await getActivePost(postId);

  if (post.author_user_id === ownedProfile.account.id) {
    throw new SquareError("You cannot repost your own Square post.", 400);
  }

  if (post.is_anonymous) {
    throw new SquareError("Anonymous posts cannot be reposted.", 400);
  }

  await assertCanViewSquareUser(ownedProfile.account.id, post.author_user_id);
  const supabase = createSupabaseAdminClient();
  const cleanCommentary = commentary?.trim() || null;
  const { data: existing, error: existingError } = await supabase
    .from("square_reposts")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", ownedProfile.account.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return { postId, reposted: true, repostCount: post.repost_count };
  }

  const { error } = await supabase.from("square_reposts").insert({
    commentary: cleanCommentary,
    post_id: postId,
    profile_id: ownedProfile.profile.id,
    user_id: ownedProfile.account.id,
  });

  if (error) {
    throw error;
  }

  const repostCount = await refreshPostCount(postId, "reposts");

  await createNotification({
    actorUserId: ownedProfile.account.id,
    data: {
      postId,
      profileId: ownedProfile.profile.id,
    },
    dedupeKey: `square_repost:${postId}:${ownedProfile.account.id}:${post.author_user_id}`,
    entityId: postId,
    entityType: "square_post",
    recipientUserId: post.author_user_id,
    type: "square_repost",
  });

  return { postId, repostCount, reposted: true };
}

async function createSquareCommentNotifications({
  commentId,
  ownedProfile,
  parentComment,
  post,
  postId,
}: {
  commentId: string;
  ownedProfile: OwnedProfile;
  parentComment: SquareCommentRow | null;
  post: SquarePostRow;
  postId: string;
}) {
  const notifications: Array<Promise<unknown>> = [];

  if (parentComment && parentComment.author_user_id !== ownedProfile.account.id) {
    notifications.push(
      createNotification({
        actorUserId: ownedProfile.account.id,
        data: {
          commentId,
          postId,
          profileId: ownedProfile.profile.id,
        },
        entityId: commentId,
        entityType: "square_comment",
        recipientUserId: parentComment.author_user_id,
        type: "square_reply",
      }),
    );
  }

  if (
    post.author_user_id !== ownedProfile.account.id &&
    post.author_user_id !== parentComment?.author_user_id
  ) {
    notifications.push(
      createNotification({
        actorUserId: ownedProfile.account.id,
        data: {
          commentId,
          postId,
          profileId: ownedProfile.profile.id,
        },
        entityId: commentId,
        entityType: "square_comment",
        recipientUserId: post.author_user_id,
        type: "square_comment",
      }),
    );
  }

  await Promise.all(notifications);
}

export async function deleteSquareRepost({
  ownedProfile,
  repostId,
}: {
  ownedProfile: OwnedProfile;
  repostId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: repost, error: readError } = await supabase
    .from("square_reposts")
    .select("id, post_id")
    .eq("id", repostId)
    .eq("user_id", ownedProfile.account.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!repost) {
    throw new SquareError("Repost not found.", 404);
  }

  const { error } = await supabase
    .from("square_reposts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", repostId)
    .eq("user_id", ownedProfile.account.id);

  if (error) {
    throw error;
  }

  await refreshPostCount(repost.post_id as string, "reposts");

  return { deleted: true, repostId };
}

export async function voteSquarePoll({
  optionId,
  ownedProfile,
  postId,
}: {
  optionId: string;
  ownedProfile: OwnedProfile;
  postId: string;
}) {
  const post = await getActivePost(postId);
  await assertCanViewSquareUser(ownedProfile.account.id, post.author_user_id);
  const supabase = createSupabaseAdminClient();
  const { data: option, error: optionError } = await supabase
    .from("square_poll_options")
    .select("id, poll_id")
    .eq("id", optionId)
    .maybeSingle();

  if (optionError) {
    throw optionError;
  }

  if (!option) {
    throw new SquareError("Poll option not found.", 404);
  }

  const { data: poll, error: pollError } = await supabase
    .from("square_polls")
    .select("id, post_id")
    .eq("id", option.poll_id)
    .eq("post_id", postId)
    .maybeSingle();

  if (pollError) {
    throw pollError;
  }

  if (!poll) {
    throw new SquareError("Poll not found.", 404);
  }

  const { error } = await supabase.from("square_poll_votes").upsert(
    {
      option_id: optionId,
      poll_id: option.poll_id,
      user_id: ownedProfile.account.id,
    },
    { onConflict: "poll_id,user_id" },
  );

  if (error) {
    throw error;
  }

  return { optionId, postId, voted: true };
}

export async function reportSquarePost({
  details,
  ownedProfile,
  postId,
  reason,
}: {
  details?: string;
  ownedProfile: OwnedProfile;
  postId: string;
  reason: string;
}) {
  const post = await getActivePost(postId);

  if (post.author_user_id === ownedProfile.account.id) {
    throw new SquareError("You cannot report your own post.", 400);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("square_reports")
    .insert({
      details: details ?? null,
      post_id: postId,
      reason,
      reported_user_id: post.author_user_id,
      reporter_user_id: ownedProfile.account.id,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return { reportId: data.id };
}

export async function reportSquareComment({
  commentId,
  details,
  ownedProfile,
  reason,
}: {
  commentId: string;
  details?: string;
  ownedProfile: OwnedProfile;
  reason: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: comment, error: commentError } = await supabase
    .from("square_comments")
    .select("*")
    .eq("id", commentId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (commentError) {
    throw commentError;
  }

  const row = comment as SquareCommentRow | null;

  if (!row) {
    throw new SquareError("Comment not found.", 404);
  }

  if (row.author_user_id === ownedProfile.account.id) {
    throw new SquareError("You cannot report your own comment.", 400);
  }

  const { data, error } = await supabase
    .from("square_reports")
    .insert({
      comment_id: commentId,
      details: details ?? null,
      post_id: row.post_id,
      reason,
      reported_user_id: row.author_user_id,
      reporter_user_id: ownedProfile.account.id,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return { reportId: data.id };
}

export async function muteSquareUser({
  mutedUserId,
  muted,
  ownedProfile,
}: {
  muted: boolean;
  mutedUserId: string;
  ownedProfile: OwnedProfile;
}) {
  if (mutedUserId === ownedProfile.account.id) {
    throw new SquareError("You cannot mute yourself.", 400);
  }

  const supabase = createSupabaseAdminClient();

  if (muted) {
    const { error } = await supabase.from("square_mutes").upsert(
      {
        muted_user_id: mutedUserId,
        muter_user_id: ownedProfile.account.id,
      },
      { onConflict: "muter_user_id,muted_user_id" },
    );

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("square_mutes")
      .delete()
      .eq("muter_user_id", ownedProfile.account.id)
      .eq("muted_user_id", mutedUserId);

    if (error) {
      throw error;
    }
  }

  return { muted, mutedUserId };
}

export async function listSquareTopics(): Promise<SquareTopic[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("square_topics")
    .select("*")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SquareTopicRow[]).map(formatTopic);
}

export async function listTrendingTopics(): Promise<SquareTrendingTopic[]> {
  const supabase = createSupabaseAdminClient();
  const { data: topics, error: topicError } = await supabase
    .from("square_topics")
    .select("*")
    .eq("status", "active");

  if (topicError) {
    throw topicError;
  }

  const topicRows = (topics ?? []) as SquareTopicRow[];

  if (topicRows.length === 0) {
    return [];
  }

  const { data: postTopics, error } = await supabase
    .from("square_post_topics")
    .select("topic_id")
    .in(
      "topic_id",
      topicRows.map((topic) => topic.id),
    );

  if (error) {
    throw error;
  }

  const counts = new Map<string, number>();
  (postTopics ?? []).forEach((row) => {
    const topicId = row.topic_id as string;
    counts.set(topicId, (counts.get(topicId) ?? 0) + 1);
  });

  return topicRows
    .map((topic) => ({
      ...formatTopic(topic),
      postCount: counts.get(topic.id) ?? 0,
    }))
    .sort((left, right) => right.postCount - left.postCount || left.name.localeCompare(right.name))
    .slice(0, 8);
}

async function getTopicBySlug(slug: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("square_topics")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? formatTopic(data as SquareTopicRow) : null;
}

async function hydrateSquarePosts({
  currentUserId,
  posts,
}: {
  currentUserId: string;
  posts: SquarePostRow[];
}): Promise<SquarePost[]> {
  if (posts.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const postIds = posts.map((post) => post.id);
  const authorUserIds = Array.from(new Set(posts.map((post) => post.author_user_id)));
  const [
    profileResult,
    postTopicsResult,
    likesResult,
    repostsResult,
    pollResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, user_id, display_name, avatar_url, city, region, country, visibility, email_verified_at, phone_verified_at, identity_verified_at",
      )
      .in("user_id", authorUserIds),
    supabase
      .from("square_post_topics")
      .select("post_id, topic_id")
      .in("post_id", postIds),
    supabase
      .from("square_likes")
      .select("post_id")
      .in("post_id", postIds)
      .eq("user_id", currentUserId),
    supabase
      .from("square_reposts")
      .select("post_id")
      .in("post_id", postIds)
      .eq("user_id", currentUserId)
      .is("deleted_at", null),
    supabase.from("square_polls").select("*").in("post_id", postIds),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (postTopicsResult.error) {
    throw postTopicsResult.error;
  }

  if (likesResult.error) {
    throw likesResult.error;
  }

  if (repostsResult.error) {
    throw repostsResult.error;
  }

  if (pollResult.error) {
    throw pollResult.error;
  }

  const profilesByUserId = new Map(
    ((profileResult.data ?? []) as SquareProfileRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );
  const postTopicRows = (postTopicsResult.data ?? []) as Array<{
    post_id: string;
    topic_id: string;
  }>;
  const topicIds = Array.from(new Set(postTopicRows.map((row) => row.topic_id)));
  const topics = topicIds.length ? await getTopicsByIds(topicIds) : new Map<string, SquareTopic>();
  const topicsByPostId = new Map<string, SquareTopic[]>();
  postTopicRows.forEach((row) => {
    const topic = topics.get(row.topic_id);

    if (!topic) {
      return;
    }

    const currentTopics = topicsByPostId.get(row.post_id) ?? [];
    currentTopics.push(topic);
    topicsByPostId.set(row.post_id, currentTopics);
  });

  const likedPostIds = new Set(
    ((likesResult.data ?? []) as Array<{ post_id: string }>).map(
      (row) => row.post_id,
    ),
  );
  const repostedPostIds = new Set(
    ((repostsResult.data ?? []) as Array<{ post_id: string }>).map(
      (row) => row.post_id,
    ),
  );
  const polls = (pollResult.data ?? []) as SquarePollRow[];
  const pollsByPostId = await hydratePolls({
    currentUserId,
    polls,
  });

  return posts.map((post) => {
    const profile = profilesByUserId.get(post.author_user_id) ?? null;
    const postTopics = topicsByPostId.get(post.id) ?? [];

    return {
      author: formatAuthor(post, profile),
      body: post.body ?? "",
      caption: post.caption,
      city: post.city ?? profile?.city ?? "Tribe Square",
      commentCount: post.comment_count,
      comments: [],
      createdAt: post.created_at,
      editedAt: post.edited_at ?? null,
      hashtags: postTopics.map((topic) => topic.slug),
      id: post.id,
      imageUrl: post.image_url,
      isAnonymous: post.is_anonymous,
      isLiked: likedPostIds.has(post.id),
      isMine: post.author_user_id === currentUserId,
      isReposted: repostedPostIds.has(post.id),
      likeCount: post.like_count,
      poll: pollsByPostId.get(post.id) ?? null,
      postType: post.post_type,
      repostCount: post.repost_count,
      topics: postTopics,
    };
  });
}

async function hydrateSquareComments({
  comments,
  currentUserId,
}: {
  comments: SquareCommentRow[];
  currentUserId: string;
}): Promise<SquareComment[]> {
  if (comments.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const userIds = Array.from(new Set(comments.map((comment) => comment.author_user_id)));
  const commentIds = comments.map((comment) => comment.id);
  const [profileResult, likeResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, user_id, display_name, avatar_url, city, region, country, visibility, email_verified_at, phone_verified_at, identity_verified_at",
      )
      .in("user_id", userIds),
    supabase
      .from("square_comment_likes")
      .select("comment_id")
      .in("comment_id", commentIds)
      .eq("user_id", currentUserId),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (likeResult.error) {
    throw likeResult.error;
  }

  const profilesByUserId = new Map(
    ((profileResult.data ?? []) as SquareProfileRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );
  const likedCommentIds = new Set(
    ((likeResult.data ?? []) as Array<{ comment_id: string }>).map(
      (row) => row.comment_id,
    ),
  );

  return comments.map((comment) => ({
    author: formatAuthor(
      {
        author_user_id: comment.author_user_id,
        is_anonymous: false,
      } as SquarePostRow,
      profilesByUserId.get(comment.author_user_id) ?? null,
    ),
    body: comment.body,
    createdAt: comment.created_at,
    editedAt: comment.edited_at ?? null,
    id: comment.id,
    isLiked: likedCommentIds.has(comment.id),
    isMine: comment.author_user_id === currentUserId,
    likeCount: comment.like_count ?? 0,
    parentCommentId: comment.parent_comment_id ?? null,
  }));
}

async function hydratePolls({
  currentUserId,
  polls,
}: {
  currentUserId: string;
  polls: SquarePollRow[];
}) {
  const pollsByPostId = new Map<string, SquarePoll>();

  if (polls.length === 0) {
    return pollsByPostId;
  }

  const supabase = createSupabaseAdminClient();
  const pollIds = polls.map((poll) => poll.id);
  const [optionsResult, votesResult] = await Promise.all([
    supabase
      .from("square_poll_options")
      .select("*")
      .in("poll_id", pollIds)
      .order("sort_order", { ascending: true }),
    supabase.from("square_poll_votes").select("*").in("poll_id", pollIds),
  ]);

  if (optionsResult.error) {
    throw optionsResult.error;
  }

  if (votesResult.error) {
    throw votesResult.error;
  }

  const options = (optionsResult.data ?? []) as SquarePollOptionRow[];
  const votes = (votesResult.data ?? []) as SquarePollVoteRow[];
  const votesByOptionId = new Map<string, number>();
  const selectedOptionByPollId = new Map<string, string>();

  votes.forEach((vote) => {
    votesByOptionId.set(
      vote.option_id,
      (votesByOptionId.get(vote.option_id) ?? 0) + 1,
    );

    if (vote.user_id === currentUserId) {
      selectedOptionByPollId.set(vote.poll_id, vote.option_id);
    }
  });

  polls.forEach((poll) => {
    const pollOptions = options.filter((option) => option.poll_id === poll.id);
    const totalVotes = pollOptions.reduce(
      (total, option) => total + (votesByOptionId.get(option.id) ?? 0),
      0,
    );

    pollsByPostId.set(poll.post_id, {
      closesAt: poll.closes_at,
      id: poll.id,
      options: pollOptions.map((option) => ({
        body: option.body,
        id: option.id,
        isSelected: selectedOptionByPollId.get(poll.id) === option.id,
        voteCount: votesByOptionId.get(option.id) ?? 0,
      })),
      question: poll.question,
      totalVotes,
    });
  });

  return pollsByPostId;
}

async function getTopicsByIds(topicIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("square_topics")
    .select("*")
    .in("id", topicIds)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as SquareTopicRow[]).map((topic) => [
      topic.id,
      formatTopic(topic),
    ]),
  );
}

function formatAuthor(
  post: Pick<SquarePostRow, "author_user_id" | "is_anonymous">,
  profile: SquareProfileRow | null,
): SquareAuthor {
  if (post.is_anonymous) {
    return {
      avatarUrl: null,
      city: "Private share",
      name: "Anonymous member",
      profileHref: null,
      profileId: null,
      userId: null,
      verification: null,
    };
  }

  return {
    avatarUrl: profile?.avatar_url ?? null,
    city: formatLocation(profile),
    name: profile?.display_name ?? "Tribe member",
    profileHref: profile?.id ? `/profiles/${profile.id}` : null,
    profileId: profile?.id ?? null,
    userId: post.author_user_id,
    verification: profile ? getProfileVerification(profile) : null,
  };
}

function formatTopic(topic: SquareTopicRow): SquareTopic {
  return {
    description: topic.description,
    id: topic.id,
    name: topic.name,
    slug: topic.slug,
  };
}

function normalizePostInput(input: SquarePostInput) {
  const isAnonymous =
    input.isAnonymous === true || input.postType === "anonymous_thought";
  const body = input.body?.trim() || "";
  const caption = input.caption?.trim() || "";
  const pollQuestion = input.pollQuestion?.trim() || "";
  const pollOptions = (input.pollOptions ?? [])
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (input.postType === "poll") {
    if (!pollQuestion && !body) {
      throw new SquareError("Polls need a question.", 400);
    }

    if (pollOptions.length < 2) {
      throw new SquareError("Polls need at least two options.", 400);
    }
  } else if (!body && !caption && input.postType !== "photo") {
    throw new SquareError("Square posts need text.", 400);
  }

  return {
    body: body || (pollQuestion && input.postType === "poll" ? pollQuestion : null),
    caption: caption || null,
    isAnonymous,
    pollOptions,
    pollQuestion: pollQuestion || null,
    postType: input.postType,
    topics: input.topics ?? [],
  };
}

function assertAnonymousPostAllowed(
  input: ReturnType<typeof normalizePostInput>,
  ownedProfile: OwnedProfile,
) {
  if (input.postType !== "anonymous_thought" && input.postType !== "thought") {
    throw new SquareError("Anonymous posts are text-only thoughts in v1.", 400);
  }

  if ((ownedProfile.profile.profile_completion_score ?? 0) < 80) {
    throw new SquareError(
      "Complete your profile before posting anonymously.",
      403,
    );
  }
}

async function assertSquarePostRateLimit({
  isAnonymous,
  userId,
}: {
  isAnonymous: boolean;
  userId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - postWindowMs).toISOString();
  const { count, error } = await supabase
    .from("square_posts")
    .select("id", { count: "exact", head: true })
    .eq("author_user_id", userId)
    .gte("created_at", since)
    .is("deleted_at", null)
    .eq("is_anonymous", isAnonymous);

  if (error) {
    throw error;
  }

  const limit = isAnonymous ? maxAnonymousPostsPerWindow : maxPostsPerWindow;

  if ((count ?? 0) >= limit) {
    throw new SquareError(
      isAnonymous
        ? "Anonymous posting is limited for safety. Try again later."
        : "Please slow down before posting again.",
      429,
    );
  }
}

async function assertSquareCommentRateLimit(userId: string) {
  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - commentWindowMs).toISOString();
  const { count, error } = await supabase
    .from("square_comments")
    .select("id", { count: "exact", head: true })
    .eq("author_user_id", userId)
    .gte("created_at", since)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  if ((count ?? 0) >= maxCommentsPerWindow) {
    throw new SquareError("Please slow down before commenting again.", 429);
  }
}

async function getActivePost(postId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("square_posts")
    .select("*")
    .eq("id", postId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new SquareError("Square post not found.", 404);
  }

  return data as SquarePostRow;
}

async function getActiveComment(commentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("square_comments")
    .select("*")
    .eq("id", commentId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new SquareError("Comment not found.", 404);
  }

  return data as SquareCommentRow;
}

async function assertCanViewSquareUser(viewerUserId: string, authorUserId: string) {
  const hiddenUserIds = await getHiddenSquareUserIds(viewerUserId);

  if (hiddenUserIds.has(authorUserId)) {
    throw new SquareError("Square post not found.", 404);
  }
}

async function getHiddenSquareUserIds(userId: string) {
  const supabase = createSupabaseAdminClient();
  const [blockedByViewer, blockedViewer, mutedByViewer] = await Promise.all([
    supabase
      .from("blocked_users")
      .select("blocked_user_id")
      .eq("blocker_user_id", userId),
    supabase
      .from("blocked_users")
      .select("blocker_user_id")
      .eq("blocked_user_id", userId),
    supabase
      .from("square_mutes")
      .select("muted_user_id")
      .eq("muter_user_id", userId),
  ]);

  if (blockedByViewer.error) {
    throw blockedByViewer.error;
  }

  if (blockedViewer.error) {
    throw blockedViewer.error;
  }

  if (mutedByViewer.error) {
    throw mutedByViewer.error;
  }

  return new Set([
    ...((blockedByViewer.data ?? []) as Array<{ blocked_user_id: string }>).map(
      (row) => row.blocked_user_id,
    ),
    ...((blockedViewer.data ?? []) as Array<{ blocker_user_id: string }>).map(
      (row) => row.blocker_user_id,
    ),
    ...((mutedByViewer.data ?? []) as Array<{ muted_user_id: string }>).map(
      (row) => row.muted_user_id,
    ),
  ]);
}

async function refreshPostCount(
  postId: string,
  kind: "comments" | "likes" | "reposts",
) {
  const supabase = createSupabaseAdminClient();
  const table =
    kind === "comments"
      ? "square_comments"
      : kind === "likes"
        ? "square_likes"
        : "square_reposts";
  let query = supabase
    .from(table)
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);

  if (kind !== "likes") {
    query = query.is("deleted_at", null);
  }

  if (kind === "comments") {
    query = query.eq("status", "active");
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  const column =
    kind === "comments"
      ? "comment_count"
      : kind === "likes"
        ? "like_count"
        : "repost_count";
  const nextCount = count ?? 0;
  const { error: updateError } = await supabase
    .from("square_posts")
    .update({
      [column]: nextCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (updateError) {
    throw updateError;
  }

  return nextCount;
}

async function refreshCommentLikeCount(commentId: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("square_comment_likes")
    .select("comment_id", { count: "exact", head: true })
    .eq("comment_id", commentId);

  if (error) {
    throw error;
  }

  const likeCount = count ?? 0;
  const { error: updateError } = await supabase
    .from("square_comments")
    .update({
      like_count: likeCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId);

  if (updateError) {
    throw updateError;
  }

  return likeCount;
}

async function attachCommentsToPosts({
  currentUserId,
  hiddenUserIds,
  posts,
}: {
  currentUserId: string;
  hiddenUserIds: Set<string>;
  posts: SquarePost[];
}) {
  if (posts.length === 0) {
    return posts;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("square_comments")
    .select("*")
    .in(
      "post_id",
      posts.map((post) => post.id),
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(Math.min(80, posts.length * 4));

  if (error) {
    throw error;
  }

  const hydratedComments = await hydrateSquareComments({
    comments: ((data ?? []) as SquareCommentRow[]).filter(
      (comment) => !hiddenUserIds.has(comment.author_user_id),
    ),
    currentUserId,
  });
  const commentsByPostId = new Map<string, SquareComment[]>();

  ((data ?? []) as SquareCommentRow[]).forEach((commentRow) => {
    const comment = hydratedComments.find(
      (hydratedComment) => hydratedComment.id === commentRow.id,
    );

    if (!comment) {
      return;
    }

    const postComments = commentsByPostId.get(commentRow.post_id) ?? [];
    postComments.push(comment);
    commentsByPostId.set(commentRow.post_id, postComments);
  });

  return posts.map((post) => ({
    ...post,
    comments: (commentsByPostId.get(post.id) ?? []).slice(0, 2),
  }));
}

async function replacePostTopics({
  postId,
  postType,
  rawTopics,
  text,
}: {
  postId: string;
  postType: SquarePostType;
  rawTopics: string[];
  text: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("square_post_topics")
    .delete()
    .eq("post_id", postId);

  if (error) {
    throw error;
  }

  await syncPostTopics({ postId, postType, rawTopics, text });
}

async function replaceMentions({
  commentId,
  mentionedByUserId,
  postId,
  tokens,
}: {
  commentId?: string;
  mentionedByUserId: string;
  postId?: string;
  tokens: string[];
}) {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("square_mentions").delete();

  if (commentId) {
    query = query.eq("comment_id", commentId);
  } else if (postId) {
    query = query.eq("post_id", postId).is("comment_id", null);
  } else {
    return;
  }

  const { error } = await query;

  if (error) {
    throw error;
  }

  await syncPostMentions({
    commentId,
    mentionedByUserId,
    postId,
    tokens,
  });
}

async function syncPostTopics({
  postId,
  postType,
  rawTopics,
  text,
}: {
  postId: string;
  postType: SquarePostType;
  rawTopics: string[];
  text: string;
}) {
  const topicSlugs = normalizeTopicInputs(rawTopics, text, postType);

  if (topicSlugs.length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const rows = topicSlugs.map((slug) => ({
    name: toTitle(slug),
    slug,
  }));
  const { error: upsertError } = await supabase
    .from("square_topics")
    .upsert(rows, { onConflict: "slug" });

  if (upsertError) {
    throw upsertError;
  }

  const { data: topics, error: readError } = await supabase
    .from("square_topics")
    .select("id, slug")
    .in("slug", topicSlugs);

  if (readError) {
    throw readError;
  }

  const postTopicRows = (topics ?? []).map((topic) => ({
    post_id: postId,
    topic_id: topic.id,
  }));

  if (postTopicRows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("square_post_topics")
    .upsert(postTopicRows, { onConflict: "post_id,topic_id" });

  if (error) {
    throw error;
  }
}

async function syncPostMentions({
  commentId,
  mentionedByUserId,
  postId,
  tokens,
}: {
  commentId?: string;
  mentionedByUserId: string;
  postId?: string;
  tokens: string[];
}) {
  if (tokens.length === 0) {
    return;
  }

  const mentionedUsers = await resolveMentionedUsers(tokens);
  const hiddenUserIds = await getHiddenSquareUserIds(mentionedByUserId);
  const blockedMention = mentionedUsers.find((user) =>
    hiddenUserIds.has(user.userId),
  );

  if (blockedMention) {
    throw new SquareError("You cannot mention blocked or muted users.", 403);
  }

  if (mentionedUsers.length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("square_mentions").insert(
    mentionedUsers.map((user) => ({
      comment_id: commentId ?? null,
      mentioned_by_user_id: mentionedByUserId,
      mentioned_user_id: user.userId,
      post_id: postId ?? null,
    })),
  );

  if (error) {
    throw error;
  }

  await Promise.all(
    mentionedUsers.map((user) =>
      createNotification({
        actorUserId: mentionedByUserId,
        data: {
          commentId: commentId ?? null,
          postId: postId ?? null,
        },
        dedupeKey: `square_mention:${postId ?? "comment"}:${commentId ?? "post"}:${mentionedByUserId}:${user.userId}`,
        entityId: commentId ?? postId ?? null,
        entityType: commentId ? "square_comment" : "square_post",
        recipientUserId: user.userId,
        type: "square_mention",
      }),
    ),
  );
}

async function resolveMentionedUsers(tokens: string[]) {
  const normalizedTokens = Array.from(new Set(tokens.map(normalizeMentionToken)));

  if (normalizedTokens.length === 0) {
    return [] as Array<{ profileId: string; userId: string }>;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, display_name")
    .neq("visibility", "private")
    .limit(500);

  if (error) {
    throw error;
  }

  const tokenSet = new Set(normalizedTokens);

  return ((data ?? []) as Array<{
    display_name: string | null;
    id: string;
    user_id: string;
  }>)
    .filter((profile) => {
      const displaySlug = slugify(profile.display_name ?? "");

      return (
        tokenSet.has(profile.id.toLowerCase()) ||
        tokenSet.has(profile.user_id.toLowerCase()) ||
        (displaySlug && tokenSet.has(displaySlug))
      );
    })
    .map((profile) => ({
      profileId: profile.id,
      userId: profile.user_id,
    }));
}

async function createPollForPost({
  options,
  postId,
  question,
}: {
  options: string[];
  postId: string;
  question: string | null;
}) {
  const cleanQuestion = question?.trim();

  if (!cleanQuestion) {
    throw new SquareError("Polls need a question.", 400);
  }

  if (options.length < 2) {
    throw new SquareError("Polls need at least two options.", 400);
  }

  const supabase = createSupabaseAdminClient();
  const { data: poll, error } = await supabase
    .from("square_polls")
    .insert({
      post_id: postId,
      question: cleanQuestion,
    })
    .select("id")
    .single();

  if (error || !poll) {
    throw error ?? new SquareError("Poll could not be created.", 500);
  }

  const { error: optionsError } = await supabase
    .from("square_poll_options")
    .insert(
      options.slice(0, 4).map((option, index) => ({
        body: option,
        poll_id: poll.id,
        sort_order: index,
      })),
    );

  if (optionsError) {
    throw optionsError;
  }
}

function normalizeTopicInputs(
  rawTopics: string[],
  text: string,
  postType: SquarePostType,
) {
  const slugs = new Set<string>();

  rawTopics.forEach((topic) => {
    const slug = slugify(topic.replace(/^#/, ""));

    if (slug) {
      slugs.add(slug);
    }
  });

  extractHashtags(text).forEach((tag) => slugs.add(tag));

  if (postType === "question") {
    slugs.add("questions");
  }

  if (postType === "poll") {
    slugs.add("questions");
  }

  if (postType === "recommendation") {
    slugs.add("recommendations");
  }

  return Array.from(slugs).slice(0, 6);
}

function extractHashtags(text: string) {
  return Array.from(text.matchAll(/#([a-zA-Z0-9_-]{2,48})/g))
    .map((match) => slugify(match[1]))
    .filter(Boolean);
}

function extractMentionTokens(text: string) {
  return Array.from(text.matchAll(/@([a-zA-Z0-9_-]{2,64})/g))
    .map((match) => match[1])
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeMentionToken(token: string) {
  return token.trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function toTitle(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function ensureSquareMediaBucket(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const bucketOptions = {
    allowedMimeTypes: [...squareImageMimeTypes],
    fileSizeLimit: squareMediaMaxBytes,
    public: true,
  };
  const { data: bucket, error: readError } =
    await supabase.storage.getBucket(squareMediaBucket);

  if (readError) {
    if (!isNotFoundError(readError)) {
      throw new SquareError(
        "Could not verify Square media storage.",
        500,
      );
    }

    const { error: createError } = await supabase.storage.createBucket(
      squareMediaBucket,
      bucketOptions,
    );

    if (createError && !isAlreadyExistsError(createError)) {
      throw new SquareError(
        "Square media storage could not be created.",
        500,
      );
    }

    return;
  }

  const bucketConfig = bucket as {
    allowed_mime_types?: string[] | null;
    file_size_limit?: number | string | null;
    public?: boolean;
  };
  const configuredMimeTypes = new Set(bucketConfig.allowed_mime_types ?? []);
  const shouldUpdateBucket =
    bucketConfig.public !== true ||
    Number(bucketConfig.file_size_limit ?? 0) !== squareMediaMaxBytes ||
    squareImageMimeTypes.some((mimeType) => !configuredMimeTypes.has(mimeType));

  if (!shouldUpdateBucket) {
    return;
  }

  const { error } = await supabase.storage.updateBucket(
    squareMediaBucket,
    bucketOptions,
  );

  if (error) {
    throw new SquareError(
      "Square media storage could not be configured.",
      500,
    );
  }
}

async function uploadSquareImage({
  file,
  ownedProfile,
  supabase,
}: {
  file: File;
  ownedProfile: OwnedProfile;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}) {
  validateSquareImageFile(file);
  const extension = getFileExtension(file.name, file.type);
  const storagePath = [
    "users",
    ownedProfile.account.id,
    "square",
    `${crypto.randomUUID()}.${extension}`,
  ].join("/");
  let fileBody: ArrayBuffer;

  try {
    fileBody = await file.arrayBuffer();
  } catch {
    throw new SquareError("Could not read the selected Square photo.");
  }

  const { error } = await supabase.storage
    .from(squareMediaBucket)
    .upload(storagePath, fileBody, {
      cacheControl: "3600",
      contentType: file.type,
      metadata: {
        kind: "square-photo",
        owner_user_id: ownedProfile.account.id,
        profile_id: ownedProfile.profile.id,
      },
      upsert: false,
    });

  if (error) {
    throw new SquareError("Square photo upload failed.", 500);
  }

  const { data } = supabase.storage
    .from(squareMediaBucket)
    .getPublicUrl(storagePath);

  if (!data.publicUrl) {
    await removeSquareMediaObjects(supabase, [storagePath]);
    throw new SquareError("Square photo uploaded without a public URL.", 500);
  }

  return {
    publicUrl: data.publicUrl,
    storagePath,
  };
}

async function removeSquareMediaObjects(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  paths: string[],
) {
  if (paths.length === 0) {
    return;
  }

  await supabase.storage.from(squareMediaBucket).remove(paths);
}

function validateSquareImageFile(file: File) {
  if (!file.name && file.size === 0) {
    throw new SquareError("Square photo is required.");
  }

  if (file.size <= 0) {
    throw new SquareError("Square photo file is empty.");
  }

  if (file.size > squareMediaMaxBytes) {
    throw new SquareError("Square photo must be 10 MB or smaller.", 413);
  }

  if (!squareImageMimeTypes.includes(file.type as (typeof squareImageMimeTypes)[number])) {
    throw new SquareError(
      `Square photo must use one of these formats: ${squareImageMimeTypes.join(", ")}.`,
    );
  }
}

function getFileExtension(fileName: string, mimeType: string) {
  const mimeExtension = squareImageExtensions[mimeType];

  if (mimeExtension) {
    return mimeExtension;
  }

  const explicitExtension = fileName.split(".").pop()?.toLowerCase();

  if (explicitExtension && /^[a-z0-9]+$/.test(explicitExtension)) {
    return explicitExtension;
  }

  return "jpg";
}

function formatLocation(profile: SquareProfileRow | null) {
  if (!profile) {
    return "Location open";
  }

  return [profile.city, profile.region, profile.country]
    .filter(Boolean)
    .join(", ") || "Location open";
}

function isNotFoundError(error: unknown) {
  return getServiceErrorMessage(error).toLowerCase().includes("not found");
}

function isAlreadyExistsError(error: unknown) {
  const message = getServiceErrorMessage(error).toLowerCase();

  return message.includes("already exists") || message.includes("duplicate");
}

function getServiceErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;

    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }

  return "Unknown error";
}
