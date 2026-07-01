import { redirect } from "next/navigation";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getVoiceSession } from "@/lib/voice/service";
import VoiceSessionClient from "./voice-session-client";

export default async function VoiceMatchPage(
  props: PageProps<"/voice/match/[sessionId]">,
) {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const { sessionId } = await props.params;
  const voiceSession = await getVoiceSession(session.ownedProfile, sessionId);

  return <VoiceSessionClient initialSession={voiceSession} />;
}
