"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  LoaderCircle,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ProfilePhotoManager } from "@/components/profile/profile-photo-manager";
import {
  availabilityOptions,
  conversationStyleOptions,
  genderOptions,
  intentOptions,
  interestOptions,
  lifestyleSignalOptions,
  personalityTypeOptions,
  type Availability,
  type ConversationStyle,
  type Gender,
  type Intent,
  type Interest,
  type LifestyleSignal,
  type PersonalityType,
} from "@/lib/onboarding/options";
import type {
  OnboardingInput,
} from "@/lib/onboarding/schema";
import type { OnboardingSnapshot } from "@/lib/onboarding/service";
import type { ProfileQualitySnapshot } from "@/lib/profile/service";

type OnboardingDraft = {
  availability: Availability | "";
  conversationStyle: ConversationStyle | "";
  gender: Gender | "";
  intent: Intent | "";
  interests: Interest[];
  lifestyleSignals: LifestyleSignal[];
  personalityType: PersonalityType | "";
  primaryGoal: string;
};

type CompleteOnboardingDraft = OnboardingDraft & {
  availability: Availability;
  conversationStyle: ConversationStyle;
  gender: Gender;
  intent: Intent;
  personalityType: PersonalityType;
};

const steps = ["Purpose", "Signals", "Interests", "Rhythm", "Photos"] as const;

const defaultDraft: OnboardingDraft = {
  availability: "",
  conversationStyle: "",
  gender: "",
  intent: "",
  interests: [],
  lifestyleSignals: [],
  personalityType: "",
  primaryGoal: "",
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function OnboardingFlow({
  displayName,
  initialQuality,
  initialResponse,
}: {
  displayName: string;
  initialQuality: ProfileQualitySnapshot;
  initialResponse: OnboardingSnapshot | null;
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    ...defaultDraft,
    ...(initialResponse ?? {}),
  }));
  const [quality, setQuality] = useState(initialQuality);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const currentStep = steps[stepIndex];
  const canContinue = useMemo(
    () => isStepComplete(stepIndex, draft, quality.hasMinimumPhotos),
    [draft, quality.hasMinimumPhotos, stepIndex],
  );
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  function updateDraft(update: Partial<OnboardingDraft>) {
    setDraft((current) => ({ ...current, ...update }));
    setError("");
  }

  function toggleLifestyle(value: LifestyleSignal) {
    setDraft((current) => ({
      ...current,
      lifestyleSignals: toggleValue(current.lifestyleSignals, value),
    }));
    setError("");
  }

  function toggleInterest(value: Interest) {
    setDraft((current) => ({
      ...current,
      interests: toggleValue(current.interests, value),
    }));
    setError("");
  }

  async function submitOnboarding() {
    if (!isCompleteDraft(draft)) {
      setError("Complete every section before opening discovery.");
      return;
    }

    setIsSaving(true);
    setError("");

    const payload: OnboardingInput = {
      availability: draft.availability,
      conversationStyle: draft.conversationStyle,
      gender: draft.gender,
      intent: draft.intent,
      interests: draft.interests,
      lifestyleSignals: draft.lifestyleSignals,
      personalityType: draft.personalityType,
      primaryGoal: draft.primaryGoal.trim(),
    };

    try {
      const response = await fetch("/api/onboarding", {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          responseBody?.error ?? "Onboarding could not be saved.",
        );
      }

      router.replace("/");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Onboarding could not be saved.",
      );
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] text-[#17201b]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-[#d8ded1] bg-[#17251f] px-5 py-5 text-[#f7f4e9] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#f6c66f] text-[#17251f]">
              <Sparkles size={20} />
            </span>
            <div>
              <p className="text-xs font-medium uppercase text-[#acc7bc]">
                Tribe
              </p>
              <h1 className="text-xl font-semibold">Onboarding</h1>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm text-[#acc7bc]">Welcome, {displayName}.</p>
            <div className="mt-4 h-2 rounded-md bg-[#385046]">
              <div
                className="h-2 rounded-md bg-[#f6c66f]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm font-semibold">{progress}% complete</p>
          </div>

          <nav className="mt-8 space-y-2">
            {steps.map((step, index) => (
              <button
                key={step}
                className={cx(
                  "flex h-11 w-full items-center justify-between rounded-md px-3 text-sm font-semibold transition",
                  index === stepIndex
                    ? "bg-[#f7f4e9] text-[#17251f]"
                    : "text-[#cddbd4] hover:bg-[#22362e]",
                )}
                onClick={() => setStepIndex(index)}
                type="button"
              >
                <span>{step}</span>
                {isStepComplete(index, draft, quality.hasMinimumPhotos) ? (
                  <Check size={16} />
                ) : null}
              </button>
            ))}
          </nav>
        </aside>

        <section className="px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-4xl">
            <header className="border-b border-[#d8ded1] pb-5">
              <p className="text-sm font-medium text-[#607265]">
                {currentStep}
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                Shape the signals people will discover you by.
              </h2>
            </header>

            <div className="mt-6">
              {stepIndex === 0 ? (
                <PurposeStep draft={draft} updateDraft={updateDraft} />
              ) : null}
              {stepIndex === 1 ? (
                <SignalsStep
                  draft={draft}
                  toggleLifestyle={toggleLifestyle}
                  updateDraft={updateDraft}
                />
              ) : null}
              {stepIndex === 2 ? (
                <InterestsStep draft={draft} toggleInterest={toggleInterest} />
              ) : null}
              {stepIndex === 3 ? (
                <RhythmStep draft={draft} updateDraft={updateDraft} />
              ) : null}
              {stepIndex === 4 ? (
                <PhotosStep quality={quality} setQuality={setQuality} />
              ) : null}
            </div>

            {error ? (
              <p className="mt-5 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]">
                {error}
              </p>
            ) : null}

            <footer className="mt-8 flex flex-col gap-3 border-t border-[#d8ded1] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6] disabled:opacity-50"
                disabled={stepIndex === 0 || isSaving}
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                type="button"
              >
                <ArrowLeft size={17} />
                Back
              </button>

              {stepIndex < steps.length - 1 ? (
                <button
                  className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#17251f] px-5 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:bg-[#9ba89f]"
                  disabled={!canContinue || isSaving}
                  onClick={() =>
                    setStepIndex((current) =>
                      Math.min(steps.length - 1, current + 1),
                    )
                  }
                  type="button"
                >
                  Continue
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#17251f] px-5 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:bg-[#9ba89f]"
                  disabled={!canContinue || isSaving}
                  onClick={submitOnboarding}
                  type="button"
                >
                  {isSaving ? (
                    <LoaderCircle className="animate-spin" size={17} />
                  ) : (
                    <Compass size={17} />
                  )}
                  Open People
                </button>
              )}
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

function PurposeStep({
  draft,
  updateDraft,
}: {
  draft: OnboardingDraft;
  updateDraft: (update: Partial<OnboardingDraft>) => void;
}) {
  return (
    <div className="space-y-6">
      <label className="block">
        <span className="text-sm font-semibold text-[#34443a]">
          Primary goal
        </span>
        <textarea
          className="mt-2 min-h-28 w-full rounded-md border border-[#cbd4c6] bg-white px-3 py-3 text-sm leading-6 text-[#17201b] outline-none transition placeholder:text-[#7c8b80] focus:border-[#17251f]"
          maxLength={180}
          onChange={(event) => updateDraft({ primaryGoal: event.target.value })}
          placeholder="Example: Find thoughtful people nearby for low-pressure plans and deeper conversations."
          value={draft.primaryGoal}
        />
      </label>

      <OptionGroup title="Intent">
        {intentOptions.map((option) => (
          <ChoiceButton
            active={draft.intent === option.value}
            icon={<Compass size={17} />}
            key={option.value}
            label={option.label}
            onClick={() => updateDraft({ intent: option.value })}
          />
        ))}
      </OptionGroup>
    </div>
  );
}

function SignalsStep({
  draft,
  toggleLifestyle,
  updateDraft,
}: {
  draft: OnboardingDraft;
  toggleLifestyle: (value: LifestyleSignal) => void;
  updateDraft: (update: Partial<OnboardingDraft>) => void;
}) {
  return (
    <div className="space-y-6">
      <OptionGroup title="Gender">
        {genderOptions.map((option) => (
          <ChoiceButton
            active={draft.gender === option.value}
            icon={<UserRound size={17} />}
            key={option.value}
            label={option.label}
            onClick={() => updateDraft({ gender: option.value })}
          />
        ))}
      </OptionGroup>
      <p className="-mt-3 text-sm leading-6 text-[#607265]">
        This is stored privately as a future matching and filtering foundation.
        It is not used as a public profile headline.
      </p>

      <OptionGroup title="Personality type">
        {personalityTypeOptions.map((option) => (
          <ChoiceButton
            active={draft.personalityType === option.value}
            icon={<UserRound size={17} />}
            key={option.value}
            label={option.label}
            onClick={() => updateDraft({ personalityType: option.value })}
          />
        ))}
      </OptionGroup>

      <OptionGroup
        meta={`${draft.lifestyleSignals.length}/8 selected`}
        title="Lifestyle signals"
      >
        {lifestyleSignalOptions.map((option) => (
          <ChoiceButton
            active={draft.lifestyleSignals.includes(option.value)}
            key={option.value}
            label={option.label}
            onClick={() => toggleLifestyle(option.value)}
          />
        ))}
      </OptionGroup>
    </div>
  );
}

function PhotosStep({
  quality,
  setQuality,
}: {
  quality: ProfileQualitySnapshot;
  setQuality: (quality: ProfileQualitySnapshot) => void;
}) {
  return (
    <section>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-[#17201b]">
          Add your profile photos
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#607265]">
          Upload at least three real photos to keep People trustworthy. Select
          several at once, then arrange the photo you want people to see first.
        </p>
      </div>
      <ProfilePhotoManager onQualityChange={setQuality} quality={quality} />
    </section>
  );
}

function InterestsStep({
  draft,
  toggleInterest,
}: {
  draft: OnboardingDraft;
  toggleInterest: (value: Interest) => void;
}) {
  return (
    <OptionGroup meta={`${draft.interests.length}/12 selected`} title="Interests">
      {interestOptions.map((option) => (
        <ChoiceButton
          active={draft.interests.includes(option.value)}
          key={option.value}
          label={option.label}
          onClick={() => toggleInterest(option.value)}
        />
      ))}
    </OptionGroup>
  );
}

function RhythmStep({
  draft,
  updateDraft,
}: {
  draft: OnboardingDraft;
  updateDraft: (update: Partial<OnboardingDraft>) => void;
}) {
  return (
    <div className="space-y-6">
      <OptionGroup title="Conversation style">
        {conversationStyleOptions.map((option) => (
          <ChoiceButton
            active={draft.conversationStyle === option.value}
            key={option.value}
            label={option.label}
            onClick={() => updateDraft({ conversationStyle: option.value })}
          />
        ))}
      </OptionGroup>

      <OptionGroup title="Availability">
        {availabilityOptions.map((option) => (
          <ChoiceButton
            active={draft.availability === option.value}
            key={option.value}
            label={option.label}
            onClick={() => updateDraft({ availability: option.value })}
          />
        ))}
      </OptionGroup>
    </div>
  );
}

function OptionGroup({
  children,
  meta,
  title,
}: {
  children: React.ReactNode;
  meta?: string;
  title: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#34443a]">{title}</h3>
        {meta ? <span className="text-sm text-[#607265]">{meta}</span> : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function ChoiceButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cx(
        "flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm font-semibold transition",
        active
          ? "border-[#17251f] bg-[#17251f] text-white"
          : "border-[#cbd4c6] bg-white text-[#34443a] hover:border-[#8fa298]",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span>{label}</span>
      </span>
      {active ? <Check className="shrink-0" size={16} /> : null}
    </button>
  );
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function isStepComplete(
  stepIndex: number,
  draft: OnboardingDraft,
  hasMinimumPhotos: boolean,
) {
  if (stepIndex === 0) {
    return draft.primaryGoal.trim().length >= 8 && Boolean(draft.intent);
  }

  if (stepIndex === 1) {
    return (
      Boolean(draft.gender) &&
      Boolean(draft.personalityType) &&
      draft.lifestyleSignals.length >= 2
    );
  }

  if (stepIndex === 2) {
    return draft.interests.length >= 3;
  }

  if (stepIndex === 3) {
    return Boolean(draft.conversationStyle) && Boolean(draft.availability);
  }

  return hasMinimumPhotos;
}

function isCompleteDraft(
  draft: OnboardingDraft,
): draft is CompleteOnboardingDraft {
  return steps
    .slice(0, 4)
    .every((_, index) => isStepComplete(index, draft, true));
}
