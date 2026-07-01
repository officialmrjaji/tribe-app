import { redirect } from "next/navigation";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { listVoiceRooms } from "@/lib/voice/service";
import VoiceHomeClient from "./voice-home-client";

export default async function VoicePage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const rooms = await listVoiceRooms(session.ownedProfile);

  return <VoiceHomeClient initialRooms={rooms} />;
}
