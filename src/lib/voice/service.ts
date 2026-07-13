import { randomUUID } from "node:crypto";
import { getDiscoveryRecommendations } from "@/lib/discovery/service";
import {
  getOnboardingStatus,
  type OnboardingSnapshot,
} from "@/lib/onboarding/service";
import {
  assertOwnedProfileHasMinimumPhotos,
  type OwnedProfile,
} from "@/lib/profile/service";
import { recordModerationAudit } from "@/lib/security/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CreateVoiceRoomInput, VoiceRoomActionInput } from "./schema";

const randomVoiceSessionMs = 2 * 60 * 1000;
const maxVoiceExtensionMs = 5 * 60 * 1000;
const maxRandomVoiceSessionMs = randomVoiceSessionMs + maxVoiceExtensionMs;

export class VoiceExperienceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "VoiceExperienceError";
    this.status = status;
  }
}

type VoiceSessionRow = {
  completed_at: string | null;
  created_at: string;
  ends_at: string;
  id: string;
  initiator_profile_id: string;
  initiator_user_id: string;
  language_signal: string | null;
  matched_profile_id: string;
  matched_user_id: string;
  matching_basis: string[];
  reveal_profiles_after: string;
  started_at: string;
  status: "active" | "cancelled" | "completed";
};

type VoiceRoomRow = {
  created_at: string;
  description: string | null;
  ends_at: string | null;
  host_profile_id: string;
  host_user_id: string;
  id: string;
  invite_code: string | null;
  language: string | null;
  locked_at?: string | null;
  max_participants: number;
  room_type: "private" | "public" | "scheduled";
  scheduled_at: string | null;
  starts_at: string | null;
  status: "cancelled" | "closed" | "open" | "scheduled";
  title: string;
  topic: string | null;
  updated_at: string;
};

type VoiceRoomParticipantRow = {
  hand_raised_at?: string | null;
  joined_at: string;
  left_at: string | null;
  muted_at?: string | null;
  profile_id: string;
  removed_at?: string | null;
  role: VoiceRoomRole;
  room_id: string;
  speaking_since?: string | null;
  user_id: string;
};

type VoiceRoomRole = "host" | "listener" | "moderator" | "speaker";

type VoiceContinueVoteRow = {
  created_at: string;
  profile_id: string;
  session_id: string;
  user_id: string;
};

type ProfileSummaryRow = {
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  display_name: string | null;
  id: string;
  region: string | null;
  user_id: string;
  voice_intro_duration_seconds: number | null;
  voice_intro_url: string | null;
};

export type VoiceProfileSummary = {
  avatarUrl: string | null;
  city: string;
  name: string;
  profileId: string;
  userId: string;
  voiceIntroDurationSeconds: number | null;
  voiceIntroUrl: string | null;
};

export type VoiceRoomParticipantSummary = VoiceProfileSummary & {
  handRaisedAt: string | null;
  isHost: boolean;
  isModerator: boolean;
  isMuted: boolean;
  isSpeaker: boolean;
  joinedAt: string;
  role: VoiceRoomRole;
  speakingSince: string | null;
};

export type VoiceSessionSummary = {
  canReveal: boolean;
  canRequestContinue: boolean;
  continueRequiredCount: number;
  continueVoteCount: number;
  continueVoted: boolean;
  endsAt: string;
  extensionLimitAt: string;
  extended: boolean;
  id: string;
  languageSignal: string | null;
  matchingBasis: string[];
  otherProfile: VoiceProfileSummary | null;
  revealProfilesAfter: string;
  revealed: boolean;
  startedAt: string;
  status: string;
};

export type VoiceRoomSummary = {
  createdAt: string;
  description: string | null;
  host: VoiceProfileSummary | null;
  id: string;
  isHost: boolean;
  isLocked: boolean;
  isMember: boolean;
  isModerator: boolean;
  language: string | null;
  maxParticipants: number;
  participantCount: number;
  participants: VoiceRoomParticipantSummary[];
  roomType: string;
  scheduledAt: string | null;
  status: string;
  title: string;
  topic: string | null;
  viewerRole: VoiceRoomRole | null;
  viewerUserId: string;
};

export async function startRandomVoiceMatch(ownedProfile: OwnedProfile) {
  await assertOwnedProfileHasMinimumPhotos(ownedProfile);
  const onboarding = await getOnboardingStatus(ownedProfile.profile.id);

  if (!onboarding.completed || !onboarding.response) {
    throw new VoiceExperienceError(
      "Complete onboarding before starting a voice match.",
      409,
    );
  }

  const discovery = await getDiscoveryRecommendations(ownedProfile);

  if (!discovery.completed || discovery.profiles.length === 0) {
    throw new VoiceExperienceError(
      "No voice-compatible profiles are available right now.",
      404,
    );
  }

  const candidates = discovery.profiles.slice(0, 8);
  const candidate = candidates[Math.floor(Math.random() * candidates.length)];
  const now = new Date();
  const endsAt = new Date(now.getTime() + randomVoiceSessionMs);
  const supabase = createSupabaseAdminClient();
  const { data: session, error } = await supabase
    .from("voice_sessions")
    .insert({
      ends_at: endsAt.toISOString(),
      initiator_profile_id: ownedProfile.profile.id,
      initiator_user_id: ownedProfile.account.id,
      language_signal: pickLanguageSignal(candidate.languages, onboarding.response),
      matched_profile_id: candidate.id,
      matched_user_id: candidate.userId,
      matching_basis: candidate.reasons.slice(0, 4),
      reveal_profiles_after: endsAt.toISOString(),
      started_at: now.toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const voiceSession = session as VoiceSessionRow;
  const { error: participantError } = await supabase
    .from("voice_session_participants")
    .upsert(
      [
        {
          profile_id: ownedProfile.profile.id,
          session_id: voiceSession.id,
          user_id: ownedProfile.account.id,
        },
        {
          profile_id: candidate.id,
          session_id: voiceSession.id,
          user_id: candidate.userId,
        },
      ],
      { onConflict: "session_id,user_id" },
    );

  if (participantError) {
    throw participantError;
  }

  return formatVoiceSession({
    continueState: {
      requiredCount: 2,
      voteCount: 0,
      voted: false,
    },
    otherProfile: null,
    session: voiceSession,
  });
}

export async function getVoiceSession(
  ownedProfile: OwnedProfile,
  sessionId: string,
) {
  const session = await getVoiceSessionForMember(ownedProfile, sessionId);
  const otherUserId =
    session.initiator_user_id === ownedProfile.account.id
      ? session.matched_user_id
      : session.initiator_user_id;
  const canReveal = canRevealSession(session);
  const otherProfile = canReveal
    ? await getProfileSummaryByUserId(otherUserId)
    : null;

  return formatVoiceSession({
    continueState: await getVoiceContinueState(session, ownedProfile.account.id),
    otherProfile,
    session,
  });
}

export async function continueVoiceSession(
  ownedProfile: OwnedProfile,
  sessionId: string,
) {
  const session = await getVoiceSessionForMember(ownedProfile, sessionId);

  if (session.status !== "active") {
    throw new VoiceExperienceError("Only active voice sessions can be extended.", 409);
  }

  if (isVoiceSessionExtended(session)) {
    throw new VoiceExperienceError("This voice session has already been extended.", 409);
  }

  if (Date.now() > getInitialVoiceEndAt(session).getTime()) {
    throw new VoiceExperienceError(
      "Continue talking is only available during the first 2 minutes.",
      409,
    );
  }

  const supabase = createSupabaseAdminClient();
  const { error: voteError } = await supabase
    .from("voice_session_continue_votes")
    .upsert(
      {
        profile_id: ownedProfile.profile.id,
        session_id: session.id,
        user_id: ownedProfile.account.id,
      },
      { onConflict: "session_id,user_id" },
    );

  if (voteError) {
    throw voteError;
  }

  const continueState = await getVoiceContinueState(
    session,
    ownedProfile.account.id,
  );

  if (continueState.voteCount >= continueState.requiredCount) {
    const now = new Date().toISOString();
    const extendedEndsAt = getMaxVoiceEndAt(session).toISOString();
    const { data, error } = await supabase
      .from("voice_sessions")
      .update({
        ends_at: extendedEndsAt,
        reveal_profiles_after: extendedEndsAt,
        updated_at: now,
      })
      .eq("id", session.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return getVoiceSession(ownedProfile, (data as VoiceSessionRow).id);
  }

  return getVoiceSession(ownedProfile, sessionId);
}

export async function revealVoiceSession(
  ownedProfile: OwnedProfile,
  sessionId: string,
) {
  const session = await getVoiceSessionForMember(ownedProfile, sessionId);

  if (!canRevealSession(session)) {
    throw new VoiceExperienceError(
      "Profiles reveal after the voice session ends.",
      403,
    );
  }

  const now = new Date().toISOString();
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("voice_sessions")
    .update({
      completed_at: session.completed_at ?? now,
      status: "completed",
      updated_at: now,
    })
    .eq("id", session.id);

  if (error) {
    throw error;
  }

  const { error: participantError } = await supabase
    .from("voice_session_participants")
    .update({ revealed_at: now })
    .eq("session_id", session.id)
    .eq("user_id", ownedProfile.account.id);

  if (participantError) {
    throw participantError;
  }

  return getVoiceSession(ownedProfile, sessionId);
}

export async function listVoiceRooms(ownedProfile: OwnedProfile) {
  const supabase = createSupabaseAdminClient();
  const { data: participantRows, error: participantError } = await supabase
    .from("voice_room_participants")
    .select("room_id")
    .eq("user_id", ownedProfile.account.id)
    .is("left_at", null);

  if (participantError) {
    throw participantError;
  }

  const memberRoomIds = ((participantRows ?? []) as Array<{ room_id: string }>)
    .map((row) => row.room_id);
  const visibleFilters = [
    "room_type.eq.public",
    "room_type.eq.scheduled",
    `host_user_id.eq.${ownedProfile.account.id}`,
  ];

  if (memberRoomIds.length) {
    visibleFilters.push(`id.in.(${memberRoomIds.join(",")})`);
  }

  const { data, error } = await supabase
    .from("voice_rooms")
    .select("*")
    .or(visibleFilters.join(","))
    .in("status", ["open", "scheduled"])
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    throw error;
  }

  return hydrateVoiceRooms(ownedProfile, (data ?? []) as VoiceRoomRow[]);
}

export async function createVoiceRoom(
  ownedProfile: OwnedProfile,
  input: CreateVoiceRoomInput,
) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const isScheduled = input.roomType === "scheduled";
  const { data, error } = await supabase
    .from("voice_rooms")
    .insert({
      description: input.description,
      host_profile_id: ownedProfile.profile.id,
      host_user_id: ownedProfile.account.id,
      invite_code: input.roomType === "private" ? buildInviteCode() : null,
      language: input.language,
      max_participants: input.maxParticipants,
      room_type: input.roomType,
      scheduled_at: input.scheduledAt,
      starts_at: isScheduled ? input.scheduledAt : now,
      status: isScheduled ? "scheduled" : "open",
      title: input.title,
      topic: input.topic,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const room = data as VoiceRoomRow;
  const { error: participantError } = await supabase
    .from("voice_room_participants")
    .insert({
      profile_id: ownedProfile.profile.id,
      role: "host",
      room_id: room.id,
      user_id: ownedProfile.account.id,
    });

  if (participantError) {
    throw participantError;
  }

  return getVoiceRoom(ownedProfile, room.id);
}

export async function getVoiceRoom(ownedProfile: OwnedProfile, roomId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("voice_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const room = data as VoiceRoomRow | null;

  if (!room) {
    throw new VoiceExperienceError("Voice room not found.", 404);
  }

  const isAllowed = await canAccessRoom(ownedProfile, room);

  if (!isAllowed) {
    throw new VoiceExperienceError("Voice room not found.", 404);
  }

  const rooms = await hydrateVoiceRooms(ownedProfile, [room]);

  return rooms[0];
}

export async function joinVoiceRoom(
  ownedProfile: OwnedProfile,
  roomId: string,
  inviteCode?: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data: roomData, error: roomError } = await supabase
    .from("voice_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError) {
    throw roomError;
  }

  const roomRow = roomData as VoiceRoomRow | null;

  if (!roomRow) {
    throw new VoiceExperienceError("Voice room not found.", 404);
  }

  const existingRoom = await hydrateVoiceRooms(ownedProfile, [roomRow]);
  const room = existingRoom[0];

  if (room.roomType === "private" && !room.isHost && !room.isMember) {
    const { data, error } = await supabase
      .from("voice_rooms")
      .select("invite_code")
      .eq("id", roomId)
      .single();

    if (error) {
      throw error;
    }

    const expectedInviteCode = (data as { invite_code: string | null })
      .invite_code;

    if (!expectedInviteCode || expectedInviteCode !== inviteCode) {
      throw new VoiceExperienceError("Private room invite code is required.", 403);
    }
  }

  if (room.participantCount >= room.maxParticipants && !room.isMember) {
    throw new VoiceExperienceError("This voice room is full.", 409);
  }

  if (room.isLocked && !room.isMember && !room.isHost) {
    throw new VoiceExperienceError("This voice room is locked.", 409);
  }

  const { data: priorParticipant, error: priorParticipantError } = await supabase
    .from("voice_room_participants")
    .select("removed_at")
    .eq("room_id", room.id)
    .eq("user_id", ownedProfile.account.id)
    .maybeSingle();

  if (priorParticipantError) {
    throw priorParticipantError;
  }

  if ((priorParticipant as { removed_at: string | null } | null)?.removed_at) {
    throw new VoiceExperienceError("You cannot rejoin this voice room.", 403);
  }

  const { error } = await supabase.from("voice_room_participants").upsert(
    {
      hand_raised_at: null,
      left_at: null,
      profile_id: ownedProfile.profile.id,
      role: room.isHost ? "host" : "listener",
      room_id: room.id,
      speaking_since: null,
      user_id: ownedProfile.account.id,
    },
    { onConflict: "room_id,user_id" },
  );

  if (error) {
    throw error;
  }

  return getVoiceRoom(ownedProfile, roomId);
}

export async function applyVoiceRoomAction(
  ownedProfile: OwnedProfile,
  roomId: string,
  input: VoiceRoomActionInput,
) {
  const supabase = createSupabaseAdminClient();
  const room = await getVoiceRoom(ownedProfile, roomId);
  const actor = room.participants.find(
    (participant) => participant.userId === ownedProfile.account.id,
  );
  const isActorHost = room.isHost;
  const isActorModerator = isActorHost || actor?.role === "moderator";
  const now = new Date().toISOString();

  if (
    (room.status === "closed" || room.status === "cancelled") &&
    input.action !== "leave_room"
  ) {
    throw new VoiceExperienceError("This voice room has ended.", 409);
  }

  if (
    !actor &&
    !isActorHost &&
    input.action !== "lock_room" &&
    input.action !== "unlock_room" &&
    input.action !== "end_room"
  ) {
    throw new VoiceExperienceError("Join the room before using room controls.", 403);
  }

  if (input.action === "raise_hand") {
    if (isActorHost) {
      throw new VoiceExperienceError("Hosts can already guide the room.", 400);
    }

    await updateParticipant({
      roomId,
      userId: ownedProfile.account.id,
      values: { hand_raised_at: now },
    });

    return getVoiceRoom(ownedProfile, roomId);
  }

  if (input.action === "cancel_raise_hand") {
    await updateParticipant({
      roomId,
      userId: ownedProfile.account.id,
      values: { hand_raised_at: null },
    });

    return getVoiceRoom(ownedProfile, roomId);
  }

  if (input.action === "leave_room") {
    if (isActorHost) {
      await closeVoiceRoom({ endedBy: ownedProfile, roomId });
    } else {
      await updateParticipant({
        roomId,
        userId: ownedProfile.account.id,
        values: {
          hand_raised_at: null,
          left_at: now,
          speaking_since: null,
        },
      });
    }

    return getVoiceRoom(ownedProfile, roomId).catch(() => room);
  }

  if (input.action === "lock_room" || input.action === "unlock_room") {
    assertHost(isActorHost);
    const { error } = await supabase
      .from("voice_rooms")
      .update({
        locked_at: input.action === "lock_room" ? now : null,
        updated_at: now,
      })
      .eq("id", roomId)
      .eq("host_user_id", ownedProfile.account.id);

    if (error) {
      throw error;
    }

    await auditVoiceRoomAction({
      action: input.action,
      ownedProfile,
      roomId,
    });

    return getVoiceRoom(ownedProfile, roomId);
  }

  if (input.action === "end_room") {
    assertHost(isActorHost);
    await closeVoiceRoom({ endedBy: ownedProfile, roomId });

    return getVoiceRoom(ownedProfile, roomId).catch(() => room);
  }

  if (!input.targetUserId) {
    throw new VoiceExperienceError("Choose a participant first.", 400);
  }

  const target = room.participants.find(
    (participant) => participant.userId === input.targetUserId,
  );

  if (!target) {
    throw new VoiceExperienceError("Participant not found in this room.", 404);
  }

  if (target.userId === ownedProfile.account.id) {
    throw new VoiceExperienceError("Choose another participant for this action.", 400);
  }

  if (
    input.action === "approve_speaker" ||
    input.action === "reject_speaker" ||
    input.action === "remove_participant"
  ) {
    assertModerator(isActorModerator);

    if (!isActorHost && (target.role === "host" || target.role === "moderator")) {
      throw new VoiceExperienceError(
        "Moderators cannot change host or moderator status.",
        403,
      );
    }
  }

  if (
    input.action === "promote_moderator" ||
    input.action === "demote_moderator"
  ) {
    assertHost(isActorHost);

    if (target.role === "host") {
      throw new VoiceExperienceError("The host role cannot be changed here.", 403);
    }
  }

  if (input.action === "approve_speaker") {
    await updateParticipant({
      roomId,
      userId: target.userId,
      values: {
        hand_raised_at: null,
        role: "speaker",
        speaking_since: now,
      },
    });
  }

  if (input.action === "reject_speaker") {
    await updateParticipant({
      roomId,
      userId: target.userId,
      values: {
        hand_raised_at: null,
        role: target.role === "moderator" ? "moderator" : "listener",
        speaking_since: null,
      },
    });
  }

  if (input.action === "remove_participant") {
    await updateParticipant({
      roomId,
      userId: target.userId,
      values: {
        hand_raised_at: null,
        left_at: now,
        removed_at: now,
        speaking_since: null,
      },
    });
  }

  if (input.action === "promote_moderator") {
    await updateParticipant({
      roomId,
      userId: target.userId,
      values: {
        hand_raised_at: null,
        role: "moderator",
        speaking_since: null,
      },
    });
  }

  if (input.action === "demote_moderator") {
    await updateParticipant({
      roomId,
      userId: target.userId,
      values: {
        role: "listener",
        speaking_since: null,
      },
    });
  }

  await auditVoiceRoomAction({
    action: input.action,
    ownedProfile,
    roomId,
    targetUserId: target.userId,
  });

  return getVoiceRoom(ownedProfile, roomId);
}

async function getVoiceSessionForMember(
  ownedProfile: OwnedProfile,
  sessionId: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("voice_sessions")
    .select("*")
    .eq("id", sessionId)
    .or(
      `initiator_user_id.eq.${ownedProfile.account.id},matched_user_id.eq.${ownedProfile.account.id}`,
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  const session = data as VoiceSessionRow | null;

  if (!session) {
    throw new VoiceExperienceError("Voice session not found.", 404);
  }

  return session;
}

async function hydrateVoiceRooms(
  ownedProfile: OwnedProfile,
  rooms: VoiceRoomRow[],
) {
  if (rooms.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const roomIds = rooms.map((room) => room.id);
  const { data: participantRows, error: participantError } = await supabase
    .from("voice_room_participants")
    .select("*")
    .in("room_id", roomIds)
    .is("left_at", null);

  if (participantError) {
    throw participantError;
  }

  const participants = (participantRows ?? []) as VoiceRoomParticipantRow[];
  const userIds = Array.from(
    new Set([
      ...rooms.map((room) => room.host_user_id),
      ...participants.map((participant) => participant.user_id),
    ]),
  );
  const profilesByUserId = await getProfilesByUserIds(userIds);

  return rooms.map((room) => {
    const roomParticipants = participants.filter(
      (participant) => participant.room_id === room.id,
    );
    const participantSummaries = roomParticipants
      .map((participant) => {
        const profile = profilesByUserId.get(participant.user_id);

        if (!profile) {
          return null;
        }

        return {
          ...profile,
          handRaisedAt: participant.hand_raised_at ?? null,
          isHost: participant.role === "host",
          isModerator:
            participant.role === "host" || participant.role === "moderator",
          isMuted: Boolean(participant.muted_at),
          isSpeaker: participant.role === "speaker" || participant.role === "host",
          joinedAt: participant.joined_at,
          role: participant.role,
          speakingSince: participant.speaking_since ?? null,
        } satisfies VoiceRoomParticipantSummary;
      })
      .filter(
        (participant): participant is VoiceRoomParticipantSummary =>
          Boolean(participant),
      )
      .sort(sortVoiceParticipants);
    const viewerParticipant =
      participantSummaries.find(
        (participant) => participant.userId === ownedProfile.account.id,
      ) ?? null;

    return {
      createdAt: room.created_at,
      description: room.description,
      host: profilesByUserId.get(room.host_user_id) ?? null,
      id: room.id,
      isHost: room.host_user_id === ownedProfile.account.id,
      isLocked: Boolean(room.locked_at),
      isMember: roomParticipants.some(
        (participant) => participant.user_id === ownedProfile.account.id,
      ),
      isModerator:
        room.host_user_id === ownedProfile.account.id ||
        viewerParticipant?.role === "moderator",
      language: room.language,
      maxParticipants: room.max_participants,
      participantCount: roomParticipants.length,
      participants: participantSummaries,
      roomType: room.room_type,
      scheduledAt: room.scheduled_at,
      status: room.status,
      title: room.title,
      topic: room.topic,
      viewerRole: viewerParticipant?.role ?? null,
      viewerUserId: ownedProfile.account.id,
    } satisfies VoiceRoomSummary;
  });
}

function sortVoiceParticipants(
  left: VoiceRoomParticipantSummary,
  right: VoiceRoomParticipantSummary,
) {
  const roleRank: Record<VoiceRoomRole, number> = {
    host: 0,
    moderator: 1,
    speaker: 2,
    listener: 3,
  };

  if (roleRank[left.role] !== roleRank[right.role]) {
    return roleRank[left.role] - roleRank[right.role];
  }

  if (Boolean(left.handRaisedAt) !== Boolean(right.handRaisedAt)) {
    return left.handRaisedAt ? -1 : 1;
  }

  return (
    new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime() ||
    left.name.localeCompare(right.name)
  );
}

async function canAccessRoom(ownedProfile: OwnedProfile, room: VoiceRoomRow) {
  if (room.room_type !== "private" || room.host_user_id === ownedProfile.account.id) {
    return true;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("voice_room_participants")
    .select("room_id")
    .eq("room_id", room.id)
    .eq("user_id", ownedProfile.account.id)
    .is("left_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function updateParticipant({
  roomId,
  userId,
  values,
}: {
  roomId: string;
  userId: string;
  values: Partial<Pick<
    VoiceRoomParticipantRow,
    | "hand_raised_at"
    | "left_at"
    | "removed_at"
    | "role"
    | "speaking_since"
  >>;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("voice_room_participants")
    .update(values)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .is("left_at", null);

  if (error) {
    throw error;
  }
}

async function closeVoiceRoom({
  endedBy,
  roomId,
}: {
  endedBy: OwnedProfile;
  roomId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("voice_rooms")
    .update({
      ends_at: now,
      status: "closed",
      updated_at: now,
    })
    .eq("id", roomId)
    .eq("host_user_id", endedBy.account.id);

  if (error) {
    throw error;
  }

  const { error: participantError } = await supabase
    .from("voice_room_participants")
    .update({
      hand_raised_at: null,
      left_at: now,
      speaking_since: null,
    })
    .eq("room_id", roomId)
    .is("left_at", null);

  if (participantError) {
    throw participantError;
  }

  await auditVoiceRoomAction({
    action: "end_room",
    ownedProfile: endedBy,
    roomId,
  });
}

function assertHost(isHost: boolean) {
  if (!isHost) {
    throw new VoiceExperienceError("Only the host can use this room control.", 403);
  }
}

function assertModerator(isModerator: boolean) {
  if (!isModerator) {
    throw new VoiceExperienceError(
      "Only the host or moderators can use this room control.",
      403,
    );
  }
}

async function auditVoiceRoomAction({
  action,
  ownedProfile,
  roomId,
  targetUserId,
}: {
  action: string;
  ownedProfile: OwnedProfile;
  roomId: string;
  targetUserId?: string;
}) {
  await recordModerationAudit({
    action: `voice_room_${action}`,
    actorClerkUserId: ownedProfile.account.clerk_user_id,
    actorUserId: ownedProfile.account.id,
    metadata: { roomId, targetUserId: targetUserId ?? null },
    targetId: targetUserId ?? roomId,
    targetType: targetUserId ? "user" : "voice_room",
  });
}

async function getProfileSummaryByUserId(userId: string) {
  const profiles = await getProfilesByUserIds([userId]);

  return profiles.get(userId) ?? null;
}

async function getProfilesByUserIds(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, VoiceProfileSummary>();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, user_id, display_name, avatar_url, city, region, country, voice_intro_url, voice_intro_duration_seconds",
    )
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as ProfileSummaryRow[]).map((profile) => [
      profile.user_id,
      {
        avatarUrl: profile.avatar_url,
        city: formatLocation(profile),
        name: profile.display_name ?? "Tribe member",
        profileId: profile.id,
        userId: profile.user_id,
        voiceIntroDurationSeconds: profile.voice_intro_duration_seconds,
        voiceIntroUrl: profile.voice_intro_url,
      },
    ]),
  );
}

function formatVoiceSession({
  continueState,
  otherProfile,
  session,
}: {
  continueState: {
    requiredCount: number;
    voteCount: number;
    voted: boolean;
  };
  otherProfile: VoiceProfileSummary | null;
  session: VoiceSessionRow;
}): VoiceSessionSummary {
  const canReveal = canRevealSession(session);
  const extended = isVoiceSessionExtended(session);
  const canRequestContinue =
    session.status === "active" &&
    !extended &&
    Date.now() <= getInitialVoiceEndAt(session).getTime();

  return {
    canReveal,
    canRequestContinue,
    continueRequiredCount: continueState.requiredCount,
    continueVoteCount: continueState.voteCount,
    continueVoted: continueState.voted,
    endsAt: session.ends_at,
    extensionLimitAt: getMaxVoiceEndAt(session).toISOString(),
    extended,
    id: session.id,
    languageSignal: session.language_signal,
    matchingBasis: session.matching_basis,
    otherProfile: canReveal ? otherProfile : null,
    revealProfilesAfter: session.reveal_profiles_after,
    revealed: Boolean(otherProfile),
    startedAt: session.started_at,
    status:
      session.status === "active" && new Date(session.ends_at).getTime() <= Date.now()
        ? "ready_to_reveal"
        : session.status,
  };
}

function canRevealSession(session: VoiceSessionRow) {
  return (
    session.status === "completed" ||
    new Date(session.reveal_profiles_after).getTime() <= Date.now()
  );
}

async function getVoiceContinueState(
  session: VoiceSessionRow,
  currentUserId: string,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("voice_session_continue_votes")
    .select("*")
    .eq("session_id", session.id);

  if (error) {
    throw error;
  }

  const votes = (data ?? []) as VoiceContinueVoteRow[];

  return {
    requiredCount: 2,
    voteCount: votes.length,
    voted: votes.some((vote) => vote.user_id === currentUserId),
  };
}

function getInitialVoiceEndAt(session: VoiceSessionRow) {
  return new Date(new Date(session.started_at).getTime() + randomVoiceSessionMs);
}

function getMaxVoiceEndAt(session: VoiceSessionRow) {
  return new Date(
    new Date(session.started_at).getTime() + maxRandomVoiceSessionMs,
  );
}

function isVoiceSessionExtended(session: VoiceSessionRow) {
  return (
    new Date(session.ends_at).getTime() >
    getInitialVoiceEndAt(session).getTime() + 1000
  );
}

function pickLanguageSignal(
  languages: string[],
  onboarding: OnboardingSnapshot,
) {
  if (languages.length) {
    return languages[0];
  }

  if (
    onboarding.intent === "language_exchange" ||
    onboarding.interests.includes("languages")
  ) {
    return "Language exchange";
  }

  return null;
}

function formatLocation(profile: ProfileSummaryRow) {
  return [profile.city, profile.region, profile.country]
    .filter(Boolean)
    .join(", ") || "Location open";
}

function buildInviteCode() {
  return randomUUID().replaceAll("-", "").slice(0, 12);
}
