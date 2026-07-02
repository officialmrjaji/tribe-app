import {
  getProfilePhotoRequirementState,
  profilePhotoRequirementMessage,
  type OwnedProfile,
} from "@/lib/profile/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications/service";

export class MessagingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MessagingError";
    this.status = status;
  }
}

type ConversationRow = {
  created_at: string;
  created_by_user_id: string;
  direct_key: string;
  id: string;
  last_message_at: string | null;
  last_message_id: string | null;
  permission_source: "manual" | "mutual_save" | "system";
  status: "active" | "closed";
  updated_at: string;
};

type ConversationMemberRow = {
  conversation_id: string;
  joined_at: string;
  left_at: string | null;
  profile_id: string;
  role: string;
  user_id: string;
};

type MessageRow = {
  body: string;
  conversation_id: string;
  created_at: string;
  deleted_at: string | null;
  id: string;
  sender_profile_id: string;
  sender_user_id: string;
  status: "moderated" | "removed" | "sent";
  updated_at: string;
};

type MessageReadRow = {
  conversation_id: string;
  last_read_message_id: string | null;
  read_at: string;
  user_id: string;
};

type MessageUnreadRow = {
  conversation_id: string;
  created_at: string;
  id: string;
  sender_user_id: string;
};

type ProfileSummaryRow = {
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  display_name: string | null;
  id: string;
  region: string | null;
  user_id: string;
};

export type ConversationParticipant = {
  avatarUrl: string | null;
  city: string;
  name: string;
  profileId: string;
  userId: string;
};

export type ConversationSummary = {
  createdAt: string;
  id: string;
  lastMessage: {
    body: string;
    createdAt: string;
    isMine: boolean;
    senderUserId: string;
  } | null;
  otherParticipants: ConversationParticipant[];
  permissionSource: string;
  status: string;
  unreadCount: number;
  updatedAt: string;
};

export type ConversationMessage = {
  body: string;
  createdAt: string;
  id: string;
  isMine: boolean;
  senderName: string;
  senderProfileId: string;
  senderUserId: string;
  status: string;
};

export type ConversationThread = {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
  pagination: {
    hasMore: boolean;
    limit: number;
    nextCursor: string | null;
  };
};

const messageSendWindowMs = 60 * 1000;
const maxMessagesPerWindow = 5;
const defaultMessagePageSize = 30;
const maxMessagePageSize = 50;

export async function listConversations(ownedProfile: OwnedProfile) {
  const supabase = createSupabaseAdminClient();
  const { data: membershipRows, error: membershipError } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("user_id", ownedProfile.account.id)
    .is("left_at", null);

  if (membershipError) {
    throw membershipError;
  }

  const memberships = (membershipRows ?? []) as ConversationMemberRow[];
  const conversationIds = memberships.map((membership) => membership.conversation_id);

  if (conversationIds.length === 0) {
    return { conversations: [] as ConversationSummary[] };
  }

  const [conversationResult, allMembersResult, readsResult] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .eq("status", "active"),
      supabase
        .from("conversation_members")
        .select("*")
        .in("conversation_id", conversationIds)
        .is("left_at", null),
      supabase
        .from("message_reads")
        .select("*")
        .in("conversation_id", conversationIds)
        .eq("user_id", ownedProfile.account.id),
    ]);

  if (conversationResult.error) {
    throw conversationResult.error;
  }

  if (allMembersResult.error) {
    throw allMembersResult.error;
  }

  if (readsResult.error) {
    throw readsResult.error;
  }

  const conversations = (conversationResult.data ?? []) as ConversationRow[];
  const allMembers = (allMembersResult.data ?? []) as ConversationMemberRow[];
  const reads = (readsResult.data ?? []) as MessageReadRow[];
  const profiles = await fetchProfilesForMembers(allMembers);
  const [lastMessagesByConversation, unreadCountsByConversation] =
    await Promise.all([
      fetchLastMessagesByConversation(conversations),
      fetchUnreadCountsByConversation({
        conversationIds,
        currentUserId: ownedProfile.account.id,
        reads,
      }),
    ]);
  const readsByConversation = new Map(
    reads.map((read) => [read.conversation_id, read]),
  );

  return {
    conversations: conversations
      .map((conversation) =>
        formatConversationSummary({
          conversation,
          currentUserId: ownedProfile.account.id,
          members: allMembers.filter(
            (member) => member.conversation_id === conversation.id,
          ),
          messages: lastMessagesByConversation.get(conversation.id)
            ? [lastMessagesByConversation.get(conversation.id) as MessageRow]
            : [],
          profiles,
          read: readsByConversation.get(conversation.id) ?? null,
          unreadCount:
            unreadCountsByConversation.get(conversation.id) ??
            0,
        }),
      )
      .sort(sortConversationSummaries),
  };
}

export async function createConversation(
  ownedProfile: OwnedProfile,
  targetProfileId: string,
) {
  const target = await getTargetProfile(targetProfileId);

  if (target.user_id === ownedProfile.account.id) {
    throw new MessagingError("You cannot message yourself.", 400);
  }

  await assertNotBlocked(ownedProfile.account.id, target.user_id);
  await assertConversationPhotoRequirements(ownedProfile.profile.id, target.id);
  await assertMutualSavePermission(ownedProfile.account.id, target.user_id);

  const supabase = createSupabaseAdminClient();
  const directKey = buildDirectKey(ownedProfile.account.id, target.user_id);
  const now = new Date().toISOString();
  const { data: insertedConversation, error: insertError } = await supabase
    .from("conversations")
    .insert({
      created_by_user_id: ownedProfile.account.id,
      direct_key: directKey,
      permission_source: "mutual_save",
      updated_at: now,
    })
    .select("*")
    .single();

  let conversation = insertedConversation as ConversationRow | null;
  let created = true;

  if (insertError) {
    if (!isDuplicateError(insertError)) {
      throw insertError;
    }

    const { data: existingConversation, error: readError } = await supabase
      .from("conversations")
      .select("*")
      .eq("direct_key", directKey)
      .single();

    if (readError) {
      throw readError;
    }

    conversation = existingConversation as ConversationRow;
    created = false;
  }

  if (!conversation) {
    throw new MessagingError("Conversation could not be created.", 500);
  }

  const { error: memberError } = await supabase
    .from("conversation_members")
    .upsert(
      [
        {
          conversation_id: conversation.id,
          profile_id: ownedProfile.profile.id,
          user_id: ownedProfile.account.id,
        },
        {
          conversation_id: conversation.id,
          profile_id: target.id,
          user_id: target.user_id,
        },
      ],
      { onConflict: "conversation_id,user_id" },
    );

  if (memberError) {
    throw memberError;
  }

  const { error: readError } = await supabase.from("message_reads").upsert(
    [
      {
        conversation_id: conversation.id,
        read_at: now,
        user_id: ownedProfile.account.id,
      },
      {
        conversation_id: conversation.id,
        read_at: now,
        user_id: target.user_id,
      },
    ],
    { onConflict: "conversation_id,user_id" },
  );

  if (readError) {
    throw readError;
  }

  if (created) {
    await createNotification({
      actorUserId: ownedProfile.account.id,
      data: {
        conversationId: conversation.id,
        profileId: ownedProfile.profile.id,
      },
      dedupeKey: `conversation_created:${conversation.id}:${target.user_id}`,
      entityId: conversation.id,
      entityType: "conversation",
      recipientUserId: target.user_id,
      type: "conversation_created",
    });
  }

  const summary = await getConversationSummaryById(
    ownedProfile,
    conversation.id,
  );

  return { conversation: summary, created };
}

async function assertConversationPhotoRequirements(
  currentProfileId: string,
  targetProfileId: string,
) {
  const [currentProfile, targetProfile] = await Promise.all([
    getProfilePhotoRequirementState(currentProfileId),
    getProfilePhotoRequirementState(targetProfileId),
  ]);

  if (!currentProfile.hasMinimumPhotos) {
    throw new MessagingError(profilePhotoRequirementMessage, 403);
  }

  if (!targetProfile.hasMinimumPhotos) {
    throw new MessagingError(
      "Both profiles need at least 3 photos before messaging unlocks.",
      403,
    );
  }
}

export async function getConversationMessages(
  ownedProfile: OwnedProfile,
  conversationId: string,
  options: {
    before?: string | null;
    limit?: number;
  } = {},
): Promise<ConversationThread> {
  const membership = await getConversationMembership(
    ownedProfile.account.id,
    conversationId,
  );

  if (!membership) {
    throw new MessagingError("Conversation not found.", 404);
  }

  const supabase = createSupabaseAdminClient();
  const limit = normalizeMessageLimit(options.limit);
  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (options.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MessageRow[];
  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse();
  const summary = await getConversationSummaryById(ownedProfile, conversationId);
  const members = await getConversationMembers(conversationId);
  const profiles = await fetchProfilesForMembers(members);

  return {
    conversation: summary,
    messages: messages.map((message) =>
      formatConversationMessage({
        currentUserId: ownedProfile.account.id,
        message,
        profiles,
      }),
    ),
    pagination: {
      hasMore,
      limit,
      nextCursor: hasMore ? (messages[0]?.created_at ?? null) : null,
    },
  };
}

export async function sendConversationMessage(
  ownedProfile: OwnedProfile,
  conversationId: string,
  body: string,
) {
  const cleanBody = body.trim();

  if (!cleanBody) {
    throw new MessagingError("Message cannot be empty.", 400);
  }

  if (cleanBody.length > 1000) {
    throw new MessagingError("Message must be 1000 characters or fewer.", 400);
  }

  const membership = await getConversationMembership(
    ownedProfile.account.id,
    conversationId,
  );

  if (!membership) {
    throw new MessagingError("Conversation not found.", 404);
  }

  const members = await getConversationMembers(conversationId);
  const otherMembers = members.filter(
    (member) => member.user_id !== ownedProfile.account.id,
  );

  for (const member of otherMembers) {
    await assertNotBlocked(ownedProfile.account.id, member.user_id);
  }

  await assertMessageRateLimit(ownedProfile.account.id, conversationId);

  const supabase = createSupabaseAdminClient();
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      body: cleanBody,
      conversation_id: conversationId,
      sender_profile_id: ownedProfile.profile.id,
      sender_user_id: ownedProfile.account.id,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const sentMessage = message as MessageRow;
  const now = new Date().toISOString();
  const { error: conversationError } = await supabase
    .from("conversations")
    .update({
      last_message_at: sentMessage.created_at,
      last_message_id: sentMessage.id,
      updated_at: sentMessage.created_at,
    })
    .eq("id", conversationId);

  if (conversationError) {
    throw conversationError;
  }

  const { error: readError } = await supabase.from("message_reads").upsert(
    {
      conversation_id: conversationId,
      last_read_message_id: sentMessage.id,
      read_at: now,
      user_id: ownedProfile.account.id,
    },
    { onConflict: "conversation_id,user_id" },
  );

  if (readError) {
    throw readError;
  }

  await Promise.all(
    otherMembers.map((member) =>
      createNotification({
        actorUserId: ownedProfile.account.id,
        data: {
          conversationId,
          messageId: sentMessage.id,
          profileId: ownedProfile.profile.id,
        },
        entityId: sentMessage.id,
        entityType: "message",
        recipientUserId: member.user_id,
        type: "new_message",
      }),
    ),
  );

  const profiles = await fetchProfilesForMembers(members);

  const conversation = await getConversationSummaryById(
    ownedProfile,
    conversationId,
  );

  return {
    conversation,
    message: formatConversationMessage({
      currentUserId: ownedProfile.account.id,
      message: sentMessage,
      profiles,
    }),
  };
}

export async function markConversationRead(
  ownedProfile: OwnedProfile,
  conversationId: string,
) {
  const membership = await getConversationMembership(
    ownedProfile.account.id,
    conversationId,
  );

  if (!membership) {
    throw new MessagingError("Conversation not found.", 404);
  }

  const supabase = createSupabaseAdminClient();
  const { data: latestMessage, error: latestError } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw latestError;
  }

  const { error } = await supabase.from("message_reads").upsert(
    {
      conversation_id: conversationId,
      last_read_message_id: latestMessage?.id ?? null,
      read_at: new Date().toISOString(),
      user_id: ownedProfile.account.id,
    },
    { onConflict: "conversation_id,user_id" },
  );

  if (error) {
    throw error;
  }

  return { conversationId, read: true };
}

export async function reportMessage({
  details,
  messageId,
  ownedProfile,
  reason,
}: {
  details?: string;
  messageId: string;
  ownedProfile: OwnedProfile;
  reason: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_user_id")
    .eq("id", messageId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const message = data as
    | {
        conversation_id: string;
        id: string;
        sender_user_id: string;
      }
    | null;

  if (!message) {
    throw new MessagingError("Message not found.", 404);
  }

  const membership = await getConversationMembership(
    ownedProfile.account.id,
    message.conversation_id,
  );

  if (!membership) {
    throw new MessagingError("Message not found.", 404);
  }

  if (message.sender_user_id === ownedProfile.account.id) {
    throw new MessagingError("You cannot report your own message.", 400);
  }

  const { data: report, error: reportError } = await supabase
    .from("message_reports")
    .insert({
      conversation_id: message.conversation_id,
      details: details ?? null,
      message_id: message.id,
      reason,
      reported_user_id: message.sender_user_id,
      reporter_user_id: ownedProfile.account.id,
    })
    .select("id")
    .single();

  if (reportError) {
    throw reportError;
  }

  return { reportId: report.id };
}

async function getConversationSummaryById(
  ownedProfile: OwnedProfile,
  conversationId: string,
) {
  const supabase = createSupabaseAdminClient();
  const [conversationResult, members, readResult, messagesResult] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("status", "active")
        .maybeSingle(),
      getConversationMembers(conversationId),
      supabase
        .from("message_reads")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("user_id", ownedProfile.account.id)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  if (conversationResult.error) {
    throw conversationResult.error;
  }

  if (readResult.error) {
    throw readResult.error;
  }

  if (messagesResult.error) {
    throw messagesResult.error;
  }

  const conversation = conversationResult.data as ConversationRow | null;

  if (!conversation) {
    throw new MessagingError("Conversation not found.", 404);
  }

  const isMember = members.some(
    (member) => member.user_id === ownedProfile.account.id && !member.left_at,
  );

  if (!isMember) {
    throw new MessagingError("Conversation not found.", 404);
  }

  const profiles = await fetchProfilesForMembers(members);

  return formatConversationSummary({
    conversation,
    currentUserId: ownedProfile.account.id,
    members,
    messages: (messagesResult.data ?? []) as MessageRow[],
    profiles,
    read: (readResult.data as MessageReadRow | null) ?? null,
  });
}

async function getConversationMembership(
  userId: string,
  conversationId: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ConversationMemberRow | null;
}

async function getConversationMembers(conversationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("conversation_members")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("left_at", null);

  if (error) {
    throw error;
  }

  return (data ?? []) as ConversationMemberRow[];
}

async function getTargetProfile(profileId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, avatar_url, city, region, country")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const target = data as ProfileSummaryRow | null;

  if (!target) {
    throw new MessagingError("Profile not found.", 404);
  }

  return target;
}

async function assertMutualSavePermission(currentUserId: string, targetUserId: string) {
  const supabase = createSupabaseAdminClient();
  const [currentSavedTarget, targetSavedCurrent] = await Promise.all([
    supabase
      .from("saved_profiles")
      .select("saved_user_id")
      .eq("viewer_user_id", currentUserId)
      .eq("saved_user_id", targetUserId)
      .maybeSingle(),
    supabase
      .from("saved_profiles")
      .select("saved_user_id")
      .eq("viewer_user_id", targetUserId)
      .eq("saved_user_id", currentUserId)
      .maybeSingle(),
  ]);

  if (currentSavedTarget.error) {
    throw currentSavedTarget.error;
  }

  if (targetSavedCurrent.error) {
    throw targetSavedCurrent.error;
  }

  if (!currentSavedTarget.data || !targetSavedCurrent.data) {
    throw new MessagingError(
      "Messaging unlocks after both people like each other.",
      403,
    );
  }
}

async function assertNotBlocked(leftUserId: string, rightUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("blocked_users")
    .select("blocker_user_id, blocked_user_id")
    .or(
      `and(blocker_user_id.eq.${leftUserId},blocked_user_id.eq.${rightUserId}),and(blocker_user_id.eq.${rightUserId},blocked_user_id.eq.${leftUserId})`,
    )
    .limit(1);

  if (error) {
    throw error;
  }

  if ((data ?? []).length > 0) {
    throw new MessagingError("Messaging is unavailable for blocked users.", 403);
  }
}

async function assertMessageRateLimit(userId: string, conversationId: string) {
  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - messageSendWindowMs).toISOString();
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("sender_user_id", userId)
    .gte("created_at", since);

  if (error) {
    throw error;
  }

  if ((count ?? 0) >= maxMessagesPerWindow) {
    throw new MessagingError(
      "Please slow down before sending another message.",
      429,
    );
  }
}

async function fetchProfilesForMembers(members: ConversationMemberRow[]) {
  const userIds = Array.from(new Set(members.map((member) => member.user_id)));

  if (userIds.length === 0) {
    return new Map<string, ProfileSummaryRow>();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, display_name, avatar_url, city, region, country")
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as ProfileSummaryRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );
}

function formatConversationSummary({
  conversation,
  currentUserId,
  members,
  messages,
  profiles,
  read,
  unreadCount,
}: {
  conversation: ConversationRow;
  currentUserId: string;
  members: ConversationMemberRow[];
  messages: MessageRow[];
  profiles: Map<string, ProfileSummaryRow>;
  read: MessageReadRow | null;
  unreadCount?: number;
}): ConversationSummary {
  const otherParticipants = members
    .filter((member) => member.user_id !== currentUserId)
    .map((member) =>
      formatParticipant(member, profiles.get(member.user_id) ?? null),
    );
  const lastMessage = messages[0] ?? null;
  const readAt = read?.read_at ? new Date(read.read_at).getTime() : 0;
  const fallbackUnreadCount = messages.filter((message) => {
    const createdAt = new Date(message.created_at).getTime();

    return message.sender_user_id !== currentUserId && createdAt > readAt;
  }).length;

  return {
    createdAt: conversation.created_at,
    id: conversation.id,
    lastMessage: lastMessage
      ? {
          body: lastMessage.body,
          createdAt: lastMessage.created_at,
          isMine: lastMessage.sender_user_id === currentUserId,
          senderUserId: lastMessage.sender_user_id,
        }
      : null,
    otherParticipants,
    permissionSource: conversation.permission_source,
    status: conversation.status,
    unreadCount: unreadCount ?? fallbackUnreadCount,
    updatedAt:
      conversation.last_message_at ?? conversation.updated_at ?? conversation.created_at,
  };
}

async function fetchLastMessagesByConversation(conversations: ConversationRow[]) {
  const lastMessageIds = conversations
    .map((conversation) => conversation.last_message_id)
    .filter((id): id is string => Boolean(id));

  if (lastMessageIds.length === 0) {
    return new Map<string, MessageRow>();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .in("id", lastMessageIds)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as MessageRow[]).map((message) => [
      message.conversation_id,
      message,
    ]),
  );
}

async function fetchUnreadCountsByConversation({
  conversationIds,
  currentUserId,
  reads,
}: {
  conversationIds: string[];
  currentUserId: string;
  reads: MessageReadRow[];
}) {
  if (conversationIds.length === 0) {
    return new Map<string, number>();
  }

  const readAtByConversation = new Map(
    reads.map((read) => [
      read.conversation_id,
      new Date(read.read_at).getTime(),
    ]),
  );
  const hasReadForEveryConversation = conversationIds.every((conversationId) =>
    readAtByConversation.has(conversationId),
  );
  const earliestReadAt = reads.length && hasReadForEveryConversation
    ? new Date(
        Math.min(
          ...reads.map((read) => new Date(read.read_at).getTime()),
        ),
      ).toISOString()
    : new Date(0).toISOString();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, created_at, sender_user_id")
    .in("conversation_id", conversationIds)
    .neq("sender_user_id", currentUserId)
    .is("deleted_at", null)
    .gt("created_at", earliestReadAt)
    .limit(5000);

  if (error) {
    throw error;
  }

  const counts = new Map<string, number>();

  ((data ?? []) as MessageUnreadRow[]).forEach((message) => {
    const readAt = readAtByConversation.get(message.conversation_id) ?? 0;
    const createdAt = new Date(message.created_at).getTime();

    if (createdAt <= readAt) {
      return;
    }

    counts.set(
      message.conversation_id,
      (counts.get(message.conversation_id) ?? 0) + 1,
    );
  });

  return counts;
}

function formatConversationMessage({
  currentUserId,
  message,
  profiles,
}: {
  currentUserId: string;
  message: MessageRow;
  profiles: Map<string, ProfileSummaryRow>;
}): ConversationMessage {
  const profile = profiles.get(message.sender_user_id);

  return {
    body: message.body,
    createdAt: message.created_at,
    id: message.id,
    isMine: message.sender_user_id === currentUserId,
    senderName: profile?.display_name ?? "Tribe member",
    senderProfileId: message.sender_profile_id,
    senderUserId: message.sender_user_id,
    status: message.status,
  };
}

function formatParticipant(
  member: ConversationMemberRow,
  profile: ProfileSummaryRow | null,
): ConversationParticipant {
  return {
    avatarUrl: profile?.avatar_url ?? null,
    city: formatLocation(profile),
    name: profile?.display_name ?? "Tribe member",
    profileId: member.profile_id,
    userId: member.user_id,
  };
}

function sortConversationSummaries(
  left: ConversationSummary,
  right: ConversationSummary,
) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function normalizeMessageLimit(limit?: number) {
  if (!limit || !Number.isFinite(limit)) {
    return defaultMessagePageSize;
  }

  return Math.max(1, Math.min(maxMessagePageSize, Math.floor(limit)));
}

function buildDirectKey(leftUserId: string, rightUserId: string) {
  return [leftUserId, rightUserId].sort().join(":");
}

function formatLocation(profile: ProfileSummaryRow | null) {
  if (!profile) {
    return "Location open";
  }

  return [profile.city, profile.region, profile.country]
    .filter(Boolean)
    .join(", ") || "Location open";
}

function isDuplicateError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;

  return code === "23505" || String(message ?? "").includes("duplicate");
}
