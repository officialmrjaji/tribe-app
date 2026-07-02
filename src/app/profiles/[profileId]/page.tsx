import {
  ArrowLeft,
  MapPin,
  Mic,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { VerificationBadges } from "@/components/profile/verification-badges";
import { VoiceIntroPlayer } from "@/components/voice/voice-intro-player";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { getProfileVerification } from "@/lib/profile/service";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type PublicProfileRow = {
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  display_name: string | null;
  email_verified_at: string | null;
  id: string;
  identity_verified_at: string | null;
  phone_verified_at: string | null;
  profile_completion_score: number;
  region: string | null;
  social_pace: string | null;
  temperament_summary: string | null;
  user_id: string;
  visibility: "discoverable" | "members" | "private";
  voice_intro_duration_seconds: number | null;
  voice_intro_url: string | null;
};

type PublicPhotoRow = {
  id: string;
  image_url: string;
};

type PublicPromptRow = {
  answer: string;
  id: string;
  prompt_text: string;
};

export default async function PublicProfilePage(
  props: PageProps<"/profiles/[profileId]">,
) {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const { profileId } = await props.params;
  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const publicProfile = profile as PublicProfileRow | null;

  if (!publicProfile) {
    notFound();
  }

  const isOwnProfile = publicProfile.user_id === session.ownedProfile.account.id;

  if (!isOwnProfile && publicProfile.visibility === "private") {
    notFound();
  }

  const now = new Date().toISOString();
  const [
    blockResult,
    photoResult,
    promptResult,
    subscriptionResult,
    boostResult,
  ] = await Promise.all([
    supabase
      .from("blocked_users")
      .select("blocker_user_id, blocked_user_id")
      .or(
        `and(blocker_user_id.eq.${session.ownedProfile.account.id},blocked_user_id.eq.${publicProfile.user_id}),and(blocker_user_id.eq.${publicProfile.user_id},blocked_user_id.eq.${session.ownedProfile.account.id})`,
      )
      .limit(1),
    supabase
      .from("profile_photos")
      .select("id, image_url")
      .eq("profile_id", publicProfile.id)
      .order("sort_order", { ascending: true })
      .limit(6),
    supabase
      .from("profile_prompts")
      .select("id, prompt_text, answer")
      .eq("profile_id", publicProfile.id)
      .order("sort_order", { ascending: true })
      .limit(3),
    supabase
      .from("premium_subscriptions")
      .select("id")
      .eq("user_id", publicProfile.user_id)
      .eq("status", "active")
      .gt("current_period_end", now)
      .limit(1),
    supabase
      .from("profile_boosts")
      .select("id")
      .eq("user_id", publicProfile.user_id)
      .eq("status", "active")
      .gt("expires_at", now)
      .limit(1),
  ]);

  if (blockResult.error) {
    throw blockResult.error;
  }

  if ((blockResult.data ?? []).length > 0) {
    notFound();
  }

  if (photoResult.error) {
    throw photoResult.error;
  }

  if (promptResult.error) {
    throw promptResult.error;
  }

  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  if (boostResult.error) {
    throw boostResult.error;
  }

  const photos = (photoResult.data ?? []) as PublicPhotoRow[];
  const prompts = (promptResult.data ?? []) as PublicPromptRow[];
  const primaryImage = photos[0]?.image_url ?? publicProfile.avatar_url;
  const isPremium = (subscriptionResult.data ?? []).length > 0;
  const hasActiveBoost = (boostResult.data ?? []).length > 0;

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-[#d8ded1] pb-5">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
            href="/explore"
          >
            <ArrowLeft size={16} />
            Explore
          </Link>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
            {primaryImage ? (
              <Image
                alt={`${publicProfile.display_name ?? "Tribe member"} profile`}
                className="h-28 w-28 rounded-md object-cover"
                height={112}
                src={primaryImage}
                width={112}
              />
            ) : (
              <span className="flex h-28 w-28 items-center justify-center rounded-md bg-[#17251f] text-white">
                <UserRound size={32} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#607265]">
                Member profile
              </p>
              <h1 className="mt-1 text-2xl font-semibold">
                {publicProfile.display_name ?? "Tribe member"}
              </h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-[#607265]">
                <MapPin size={15} />
                {[publicProfile.city, publicProfile.region, publicProfile.country]
                  .filter(Boolean)
                  .join(", ") || "Location open"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <VerificationBadges
                  verification={getProfileVerification(publicProfile)}
                />
                {isPremium ? <PremiumBadge label="Tribe Plus" /> : null}
                {hasActiveBoost ? <PremiumBadge boost /> : null}
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#607265]">
                  <ShieldCheck size={13} />
                  {publicProfile.profile_completion_score}% complete
                </span>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#607265]">About</p>
              <p className="mt-2 text-sm leading-6 text-[#34443a]">
                {publicProfile.bio ??
                  "This member has not added a public bio yet."}
              </p>
            </section>

            {photos.length ? (
              <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#607265]">Photos</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {photos.slice(0, 6).map((photo) => (
                    <Image
                      alt="Profile photo"
                      className="aspect-square rounded-md object-cover"
                      height={180}
                      key={photo.id}
                      src={photo.image_url}
                      width={180}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {prompts.length ? (
              <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#607265]">Prompts</p>
                <div className="mt-3 space-y-2">
                  {prompts.map((prompt) => (
                    <div
                      className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] px-3 py-2"
                      key={prompt.id}
                    >
                      <p className="text-xs font-semibold uppercase text-[#607265]">
                        {prompt.prompt_text}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#34443a]">
                        {prompt.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#607265]">
                Personality
              </p>
              <p className="mt-2 text-sm leading-6 text-[#34443a]">
                {publicProfile.temperament_summary ??
                  "Personality signals are still forming."}
              </p>
              {publicProfile.social_pace ? (
                <p className="mt-3 rounded-md bg-[#fbfaf4] px-3 py-2 text-sm font-semibold text-[#34443a]">
                  {publicProfile.social_pace}
                </p>
              ) : null}
            </section>

            {publicProfile.voice_intro_url ? (
              <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
                  <Mic size={15} />
                  Voice intro
                  {publicProfile.voice_intro_duration_seconds
                    ? `, ${publicProfile.voice_intro_duration_seconds}s`
                    : ""}
                </p>
                <div className="mt-3">
                  <VoiceIntroPlayer
                    durationSeconds={publicProfile.voice_intro_duration_seconds}
                    label={`${
                      publicProfile.display_name ?? "Tribe member"
                    } voice intro`}
                    src={publicProfile.voice_intro_url}
                  />
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
