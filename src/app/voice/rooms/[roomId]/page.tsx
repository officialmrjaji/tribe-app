import { redirect } from "next/navigation";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getVoiceRoom } from "@/lib/voice/service";
import VoiceRoomClient from "./voice-room-client";

export default async function VoiceRoomPage(
  props: PageProps<"/voice/rooms/[roomId]">,
) {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const { roomId } = await props.params;
  const room = await getVoiceRoom(session.ownedProfile, roomId);

  return <VoiceRoomClient initialRoom={room} />;
}
