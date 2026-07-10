import {
  ArrowLeft,
  Edit3,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { PublicProfileActions } from "@/components/profile/public-profile-actions";
import { ProfilePhotoGallery } from "@/components/profile/profile-photo-gallery";
import { VerificationBadges } from "@/components/profile/verification-badges";
import { VoiceIntroPlayer } from "@/components/voice/voice-intro-player";
import type { PublicMemberProfile } from "@/lib/profile/public-profile";

type PublicProfileViewProps = {
  backHref: string;
  backLabel: string;
  editHref?: string;
  profile: PublicMemberProfile;
  titleLabel?: string;
};

export function PublicProfileView({
  backHref,
  backLabel,
  editHref,
  profile,
  titleLabel = "Member profile",
}: PublicProfileViewProps) {
  const photoUrls = profile.photos.map((photo) => photo.imageUrl);
  const primaryImage = photoUrls[0] ?? null;

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[#d8ded1] pb-5">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
            href={backHref}
          >
            <ArrowLeft size={16} />
            {backLabel}
          </Link>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {primaryImage ? (
                <ProfilePhotoGallery
                  label={`${profile.displayName} profile photos`}
                  photos={photoUrls}
                >
                  <Image
                    alt={`${profile.displayName} profile photo`}
                    className="h-32 w-32 rounded-md object-cover"
                    height={128}
                    priority
                    src={primaryImage}
                    width={128}
                  />
                </ProfilePhotoGallery>
              ) : (
                <span className="flex h-32 w-32 items-center justify-center rounded-md bg-[#17251f] text-white">
                  <UserRound size={34} />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#607265]">
                  {titleLabel}
                </p>
                <h1 className="mt-1 text-3xl font-semibold">
                  {profile.displayName}
                  {profile.age ? `, ${profile.age}` : ""}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#607265]">
                  <span className="inline-flex items-center gap-2">
                    <MapPin size={15} />
                    {profile.city}
                  </span>
                  {profile.genderLabel ? (
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#607265]">
                      {profile.genderLabel}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <VerificationBadges verification={profile.verification} />
                  {profile.isPremium ? <PremiumBadge label="Tribe Plus" /> : null}
                  {profile.hasActiveBoost ? <PremiumBadge boost /> : null}
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#607265]">
                    <Sparkles size={13} />
                    {profile.activityLabel}
                  </span>
                </div>
              </div>
            </div>

            {editHref ? (
              <Link
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
                href={editHref}
              >
                <Edit3 size={16} />
                Edit profile
              </Link>
            ) : null}
          </div>
        </header>

        {!profile.isOwnProfile ? (
          <div className="mt-6">
            <PublicProfileActions
              profileId={profile.id}
              profileName={profile.displayName}
            />
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <ProfileSection title="About">
              <p className="text-sm leading-6 text-[#34443a]">
                {profile.bio ?? "This member has not added a public bio yet."}
              </p>
            </ProfileSection>

            {profile.photos.length ? (
              <ProfileSection title="Photos">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {profile.photos.map((photo, index) => (
                    <ProfilePhotoGallery
                      initialIndex={index}
                      key={photo.id}
                      label={`${profile.displayName} profile photo ${index + 1}`}
                      photos={photoUrls}
                    >
                      <Image
                        alt={`${profile.displayName} profile photo ${index + 1}`}
                        className="aspect-square rounded-md object-cover"
                        height={220}
                        src={photo.imageUrl}
                        width={220}
                      />
                    </ProfilePhotoGallery>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {profile.voiceIntroUrl ? (
              <ProfileSection title="Voice Intro">
                <VoiceIntroPlayer
                  durationSeconds={profile.voiceIntroDurationSeconds}
                  label={`${profile.displayName} voice intro`}
                  src={profile.voiceIntroUrl}
                />
              </ProfileSection>
            ) : null}

            {profile.prompts.length ? (
              <ProfileSection title="Prompts">
                <div className="space-y-2">
                  {profile.prompts.map((prompt) => (
                    <div
                      className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] px-3 py-2"
                      key={prompt.id}
                    >
                      <p className="text-xs font-semibold uppercase text-[#607265]">
                        {prompt.promptText}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#34443a]">
                        {prompt.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            <ProfileSection title="Interests">
              <TagList emptyLabel="Interests are still forming." values={profile.interests} />
            </ProfileSection>

            <ProfileSection title="Goals">
              <TagList emptyLabel="Goals are still forming." values={profile.goals} />
            </ProfileSection>
          </div>

          <aside className="space-y-4">
            <ProfileSection title="Personality">
              <p className="text-sm leading-6 text-[#34443a]">
                {profile.personalitySummary ??
                  "Personality signals are still forming."}
              </p>
              {profile.availability ? (
                <p className="mt-3 rounded-md bg-[#fbfaf4] px-3 py-2 text-sm font-semibold text-[#34443a]">
                  {profile.availability}
                </p>
              ) : null}
            </ProfileSection>

            <ProfileSection title="Lifestyle">
              <TagList
                emptyLabel="Lifestyle signals are still forming."
                values={profile.lifestyleSignals}
              />
            </ProfileSection>

            <ProfileSection title="Languages">
              <TagList emptyLabel="Optional" values={profile.languages} />
            </ProfileSection>

            <ProfileSection title="Verification">
              <div className="flex flex-wrap gap-2">
                <VerificationBadges verification={profile.verification} />
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#607265]">
                <ShieldCheck size={14} />
                Badges are assigned from verified account signals.
              </p>
            </ProfileSection>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ProfileSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-[#607265]">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TagList({
  emptyLabel,
  values,
}: {
  emptyLabel: string;
  values: string[];
}) {
  if (values.length === 0) {
    return <p className="text-sm leading-6 text-[#607265]">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          className="rounded-md bg-[#f0f6f2] px-2.5 py-1 text-xs font-semibold text-[#34443a]"
          key={value}
        >
          {value}
        </span>
      ))}
    </div>
  );
}
