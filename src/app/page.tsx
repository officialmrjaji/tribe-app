"use client";

import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Coffee,
  Compass,
  Heart,
  MapPin,
  MessageCircle,
  Music,
  Palette,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

type Profile = {
  id: string;
  name: string;
  age: number;
  city: string;
  image: string;
  match: number;
  archetype: string;
  temperament: string;
  pace: string;
  availability: string;
  signal: string;
  bio: string;
  traits: string[];
  circles: string[];
  prompts: string[];
  values: string[];
  axes: {
    depth: number;
    energy: number;
    curiosity: number;
  };
  accent: string;
};

const profiles: Profile[] = [
  {
    id: "aya",
    name: "Aya",
    age: 29,
    city: "Austin",
    image: "/avatars/aya.png",
    match: 96,
    archetype: "Creative Cartographer",
    temperament: "Warm, precise, open-ended",
    pace: "Slow-burn",
    availability: "2 nights this week",
    signal: "Looks for people who make ordinary plans feel intentional.",
    bio: "Design researcher, jazz learner, weekend map-maker. Prefers grounded conversations with room for strange questions.",
    traits: ["Creative", "Reflective", "Local"],
    circles: ["Live sketching", "Tiny dinner clubs", "Neighborhood walks"],
    prompts: [
      "What changed your mind recently?",
      "Which third place feels like yours?",
      "What do you notice that most people miss?",
    ],
    values: ["presence", "craft", "mutual curiosity"],
    axes: { depth: 94, energy: 62, curiosity: 91 },
    accent: "bg-[#f6c66f]",
  },
  {
    id: "milo",
    name: "Milo",
    age: 33,
    city: "Denver",
    image: "/avatars/milo.png",
    match: 91,
    archetype: "Grounded Instigator",
    temperament: "Playful, steady, candid",
    pace: "Plan-forward",
    availability: "Saturday afternoon",
    signal: "Turns shared interests into low-pressure rituals.",
    bio: "Climber, soup person, amateur facilitator. Collects questions that make groups feel less performative.",
    traits: ["Grounded", "Social", "Local"],
    circles: ["Skill swaps", "Climbing mornings", "Community kitchens"],
    prompts: [
      "What is a friendship ritual you want more of?",
      "Where do you feel useful lately?",
      "What small plan would you repeat monthly?",
    ],
    values: ["reliability", "good humor", "reciprocity"],
    axes: { depth: 83, energy: 78, curiosity: 77 },
    accent: "bg-[#94c973]",
  },
  {
    id: "nora",
    name: "Nora",
    age: 31,
    city: "Portland",
    image: "/avatars/nora.png",
    match: 89,
    archetype: "Quiet Catalyst",
    temperament: "Observant, gentle, decisive",
    pace: "Unhurried",
    availability: "Weeknight coffee",
    signal: "Enjoys people with soft confidence and uncommon taste.",
    bio: "Bookstore events lead, ambient music fan, volunteer mediator. Likes conversations that become practical kindness.",
    traits: ["Reflective", "Curious", "Grounded"],
    circles: ["Silent reading", "Ambient sets", "Repair cafes"],
    prompts: [
      "What kind of silence feels comfortable?",
      "What do your favorite people have in common?",
      "Which local project deserves more attention?",
    ],
    values: ["patience", "taste", "repair"],
    axes: { depth: 92, energy: 48, curiosity: 84 },
    accent: "bg-[#8ac5c1]",
  },
  {
    id: "jules",
    name: "Jules",
    age: 27,
    city: "Chicago",
    image: "/avatars/jules.png",
    match: 86,
    archetype: "Kinetic Connector",
    temperament: "Bright, generous, direct",
    pace: "Spontaneous",
    availability: "Tonight or Sunday",
    signal: "Builds momentum without making people perform.",
    bio: "Pop-up host, drummer, bike commuter. Best around people who can jump from jokes to meaning without fuss.",
    traits: ["Creative", "Social", "Curious"],
    circles: ["Open decks", "Food pop-ups", "Bike hangs"],
    prompts: [
      "What plan would you say yes to with one hour notice?",
      "Which song explains your week?",
      "What makes a group feel alive to you?",
    ],
    values: ["momentum", "play", "hospitality"],
    axes: { depth: 76, energy: 93, curiosity: 82 },
    accent: "bg-[#ef8f7a]",
  },
];

const focusModes = ["Deep talk", "Soft plans", "New circle"] as const;
type FocusMode = (typeof focusModes)[number];

const filterOptions = ["All", "Creative", "Grounded", "Curious", "Local"] as const;
type FilterOption = (typeof filterOptions)[number];

const axisMetrics = [
  { label: "Depth", key: "depth", icon: BookOpen },
  { label: "Energy", key: "energy", icon: Zap },
  { label: "Curiosity", key: "curiosity", icon: Star },
] as const;

const circleIcons = [Palette, Coffee, Music] as const;

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");
  const [activeFocus, setActiveFocus] = useState<FocusMode>("Deep talk");
  const [selectedId, setSelectedId] = useState(profiles[0].id);
  const [savedIds, setSavedIds] = useState<string[]>(["aya"]);

  const visibleProfiles = useMemo(() => {
    if (activeFilter === "All") {
      return profiles;
    }

    return profiles.filter((profile) => profile.traits.includes(activeFilter));
  }, [activeFilter]);

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedId) ?? profiles[0];

  const promptIndex = focusModes.indexOf(activeFocus);

  function toggleSaved(profileId: string) {
    setSavedIds((currentIds) =>
      currentIds.includes(profileId)
        ? currentIds.filter((id) => id !== profileId)
        : [...currentIds, profileId],
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] text-[#17201b]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[236px_minmax(0,1fr)_340px]">
        <aside className="border-b border-[#d8ded1] bg-[#17251f] px-4 py-4 text-[#f7f4e9] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between lg:block">
            <div>
              <p className="text-xs font-medium uppercase text-[#acc7bc]">
                Tribe
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Discovery</h1>
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-md border border-[#385046] text-[#f7f4e9] transition hover:bg-[#22362e] lg:hidden"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
          </div>

          <nav className="mt-5 grid grid-cols-4 gap-2 lg:grid-cols-1">
            {[
              { label: "Discover", icon: Compass, active: true },
              { label: "Circles", icon: Users, active: false },
              { label: "Inbox", icon: MessageCircle, active: false },
              { label: "Rituals", icon: CalendarDays, active: false },
            ].map((item) => (
              <NavButton key={item.label} item={item} />
            ))}
          </nav>

          <div className="mt-6 hidden border-t border-[#385046] pt-5 lg:block">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal size={17} />
              Signal Mix
            </div>
            <div className="mt-4 space-y-4">
              {[
                ["Conversation depth", 88],
                ["Plan reliability", 74],
                ["Social overlap", 67],
              ].map(([label, value]) => (
                <label key={label} className="block text-sm text-[#dce7e2]">
                  <span className="flex items-center justify-between">
                    <span>{label}</span>
                    <span>{value}%</span>
                  </span>
                  <input
                    className="mt-2 h-2 w-full accent-[#f6c66f]"
                    defaultValue={value}
                    max="100"
                    min="0"
                    type="range"
                  />
                </label>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-medium text-[#607265]">
                Personality-first matches
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-[#17201b]">
                Find people by pace, values, and social texture.
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm shadow-sm sm:w-72">
                <Search size={17} className="shrink-0 text-[#607265]" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-[#17201b] outline-none placeholder:text-[#7c8b80]"
                  placeholder="Search values, circles, plans"
                  type="search"
                />
              </label>
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
                type="button"
              >
                <Plus size={17} />
                New Signal
              </button>
            </div>
          </header>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {filterOptions.map((option) => (
                <button
                  key={option}
                  className={cx(
                    "h-10 rounded-md border px-4 text-sm font-semibold transition",
                    activeFilter === option
                      ? "border-[#17251f] bg-[#17251f] text-white"
                      : "border-[#cbd4c6] bg-white text-[#34443a] hover:border-[#8fa298]",
                  )}
                  onClick={() => setActiveFilter(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 rounded-md border border-[#cbd4c6] bg-white p-1">
              {focusModes.map((mode) => (
                <button
                  key={mode}
                  className={cx(
                    "h-9 rounded-md px-3 text-sm font-semibold transition",
                    activeFocus === mode
                      ? "bg-[#f6c66f] text-[#17201b]"
                      : "text-[#607265] hover:bg-[#f3f0e6]",
                  )}
                  onClick={() => setActiveFocus(mode)}
                  type="button"
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleProfiles.map((profile) => {
              const isSelected = profile.id === selectedProfile.id;
              const isSaved = savedIds.includes(profile.id);

              return (
                <article
                  key={profile.id}
                  className={cx(
                    "rounded-lg border bg-white p-4 shadow-sm transition",
                    isSelected
                      ? "border-[#17251f] shadow-md"
                      : "border-[#d8ded1] hover:border-[#9dad9f]",
                  )}
                >
                  <button
                    className="block w-full text-left"
                    onClick={() => setSelectedId(profile.id)}
                    type="button"
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
                            <h3 className="truncate text-lg font-semibold">
                              {profile.name}, {profile.age}
                            </h3>
                            <p className="mt-1 flex items-center gap-1 text-sm text-[#607265]">
                              <MapPin size={14} />
                              {profile.city}
                            </p>
                          </div>
                          <span
                            className={cx(
                              "flex h-10 w-12 shrink-0 items-center justify-center rounded-md text-sm font-bold text-[#17201b]",
                              profile.accent,
                            )}
                          >
                            {profile.match}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-[#34443a]">
                          {profile.archetype}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 min-h-12 text-sm leading-6 text-[#4e5e54]">
                      {profile.signal}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {profile.traits.map((trait) => (
                        <span
                          key={trait}
                          className="rounded-md border border-[#d8ded1] bg-[#f6f7f1] px-2.5 py-1 text-xs font-semibold text-[#34443a]"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </button>

                  <div className="mt-4 flex items-center gap-2 border-t border-[#e2e6dc] pt-3">
                    <button
                      className={cx(
                        "flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-semibold transition",
                        isSaved
                          ? "bg-[#ef8f7a] text-[#17201b]"
                          : "bg-[#edf2e9] text-[#34443a] hover:bg-[#e2eadc]",
                      )}
                      onClick={() => toggleSaved(profile.id)}
                      type="button"
                    >
                      {isSaved ? <Check size={16} /> : <Heart size={16} />}
                      {isSaved ? "Saved" : "Save"}
                    </button>
                    <button
                      className="flex h-10 w-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white text-[#34443a] transition hover:bg-[#f3f0e6]"
                      onClick={() => setSelectedId(profile.id)}
                      type="button"
                      aria-label={`Open ${profile.name}`}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="border-t border-[#d8ded1] bg-white px-4 py-5 sm:px-6 lg:border-l lg:border-t-0">
          <div className="rounded-lg border border-[#d8ded1] bg-[#fbfaf4] p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Image
                alt={`${selectedProfile.name} avatar`}
                className="h-20 w-20 rounded-md object-cover"
                height={80}
                src={selectedProfile.image}
                width={80}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#607265]">
                  Selected signal
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {selectedProfile.name}, {selectedProfile.age}
                </h2>
                <p className="mt-1 text-sm text-[#607265]">
                  {selectedProfile.temperament}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-[#34443a]">
              {selectedProfile.bio}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 border-y border-[#e2e6dc] py-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#607265]">
                  <Sparkles size={14} />
                  Pace
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {selectedProfile.pace}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#607265]">
                  <CalendarDays size={14} />
                  Open
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {selectedProfile.availability}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {axisMetrics.map((metric) => {
                const Icon = metric.icon;
                const value = selectedProfile.axes[metric.key];

                return (
                <div key={metric.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <Icon size={15} />
                      {metric.label}
                    </span>
                    <span>{value}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-md bg-[#e2e6dc]">
                    <div
                      className="h-2 rounded-md bg-[#17251f]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
                );
              })}
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-[#607265]">
                Values in common
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedProfile.values.map((value) => (
                  <span
                    key={value}
                    className="rounded-md bg-[#17251f] px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-[#607265]">
                Circle overlap
              </p>
              <div className="mt-3 space-y-2">
                {selectedProfile.circles.map((circle, index) => {
                  const Icon = circleIcons[index] ?? Users;

                  return (
                    <div
                      key={circle}
                      className="flex min-h-10 items-center justify-between border-b border-[#e2e6dc] pb-2 text-sm last:border-b-0 last:pb-0"
                    >
                      <span className="flex items-center gap-2">
                        <Icon size={16} />
                        {circle}
                      </span>
                      <ShieldCheck size={16} className="text-[#587d62]" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-[#607265]">
                Prompt for {activeFocus.toLowerCase()}
              </p>
              <div className="mt-2 rounded-md border border-[#d8ded1] bg-white p-3">
                <p className="text-sm leading-6 text-[#34443a]">
                  {selectedProfile.prompts[promptIndex]}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-[1fr_44px] gap-2">
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
                type="button"
              >
                <MessageCircle size={17} />
                Start Thread
              </button>
              <button
                className="flex h-11 items-center justify-center rounded-md bg-[#f6c66f] text-[#17201b] transition hover:bg-[#edb654]"
                type="button"
                aria-label="Send introduction"
              >
                <Send size={17} />
              </button>
            </div>
          </div>
        </aside>
      </div>
      </main>
  );
}

function NavButton({
  item,
}: {
  item: {
    label: string;
    icon: LucideIcon;
    active: boolean;
  };
}) {
  const Icon = item.icon;

  return (
    <button
      className={cx(
        "flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition lg:justify-start",
        item.active
          ? "bg-[#f7f4e9] text-[#17251f]"
          : "text-[#cddbd4] hover:bg-[#22362e]",
      )}
      type="button"
    >
      <Icon size={17} />
      <span className="hidden sm:inline">{item.label}</span>
    </button>
  );
}
