import {
  ArrowLeft,
  CalendarDays,
  Heart,
  MapPin,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { DiscoveryCollectionProfile } from "@/lib/discovery/service";

type ProfileCollectionPageProps = {
  accentLabel: string;
  description: string;
  emptyBody: string;
  emptyTitle: string;
  eyebrow: string;
  icon: LucideIcon;
  profiles: DiscoveryCollectionProfile[];
  title: string;
};

export function ProfileCollectionPage({
  accentLabel,
  description,
  emptyBody,
  emptyTitle,
  eyebrow,
  icon: Icon,
  profiles,
  title,
}: ProfileCollectionPageProps) {
  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/"
            >
              <ArrowLeft size={16} />
              Discovery
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Icon size={16} />
              {eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              {description}
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-2 sm:flex">
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/saved"
            >
              Saved
            </Link>
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/passed"
            >
              Passed
            </Link>
          </nav>
        </header>

        {profiles.length === 0 ? (
          <section className="mt-6 rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[#607265]">
              {accentLabel}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{emptyTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#34443a]">
              {emptyBody}
            </p>
            <Link
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
              href="/"
            >
              Open discovery
            </Link>
          </section>
        ) : (
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => (
              <article
                className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm"
                key={profile.id}
              >
                <div className="flex items-start gap-3">
                  <Image
                    alt={`${profile.name} avatar`}
                    className="h-16 w-16 shrink-0 rounded-md object-cover"
                    height={64}
                    src={profile.image}
                    width={64}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold">
                          {profile.name}
                          {profile.age ? `, ${profile.age}` : ""}
                        </h2>
                        <p className="mt-1 flex items-center gap-1 text-sm text-[#607265]">
                          <MapPin size={14} />
                          {profile.city}
                        </p>
                      </div>
                      <span
                        className={[
                          "flex h-10 w-12 shrink-0 items-center justify-center rounded-md text-sm font-bold text-[#17201b]",
                          profile.accent,
                        ].join(" ")}
                      >
                        {profile.match}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#34443a]">
                      {profile.archetype}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-[#4e5e54]">
                  {profile.signal}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 border-y border-[#e2e6dc] py-4">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#607265]">
                      <CalendarDays size={14} />
                      Social pace
                    </p>
                    <p className="mt-1 text-sm font-semibold">{profile.pace}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#607265]">
                      <Heart size={14} />
                      {accentLabel}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {formatDate(profile.actedAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
                    <Sparkles size={15} />
                    Match reasons
                  </p>
                  <div className="mt-2 space-y-2">
                    {profile.reasons.slice(0, 3).map((reason) => (
                      <p
                        className="flex gap-2 rounded-md border border-[#e2e6dc] bg-[#fbfaf4] px-3 py-2 text-sm leading-5 text-[#34443a]"
                        key={reason}
                      >
                        <ShieldCheck
                          className="mt-0.5 shrink-0 text-[#587d62]"
                          size={15}
                        />
                        {reason}
                      </p>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}
