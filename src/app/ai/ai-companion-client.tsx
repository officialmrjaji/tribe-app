"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  Heart,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type {
  AIConversationCoachOutput,
  AIMatchCoachOutput,
  AIProfileCoachOutput,
  AISafetyCheckOutput,
} from "@/lib/ai/schema";
import type { DiscoveryProfile } from "@/lib/discovery/service";
import type { ConversationSummary } from "@/lib/messaging/service";
import {
  interestLabels,
  type Interest,
} from "@/lib/onboarding/options";
import type { OnboardingSnapshot } from "@/lib/onboarding/service";

type ProfileDraft = {
  bio: string;
  displayName: string;
};

type PromptDraft = {
  answer: string;
  promptText: string;
};

type AICompanionClientProps = {
  conversations: ConversationSummary[];
  matches: DiscoveryProfile[];
  onboarding: OnboardingSnapshot | null;
  profile: ProfileDraft;
  prompts: PromptDraft[];
};

type ApiErrorPayload = {
  error?: string;
  issues?: Array<{
    message?: string;
  }>;
};

type PendingAction =
  | "conversation"
  | "match"
  | "profile"
  | "safety"
  | null;

const focusOptions = [
  { label: "Warm", value: "warm" },
  { label: "Curious", value: "curious" },
  { label: "Low pressure", value: "low_pressure" },
  { label: "Direct", value: "direct" },
] as const;

const contentTypes = [
  { label: "Message", value: "message" },
  { label: "Profile", value: "profile" },
  { label: "Square post", value: "square_post" },
  { label: "Comment", value: "comment" },
  { label: "Other", value: "other" },
] as const;

export default function AICompanionClient({
  conversations,
  matches,
  onboarding,
  profile,
  prompts,
}: AICompanionClientProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [bioDraft, setBioDraft] = useState(profile.bio);
  const [matchNotes, setMatchNotes] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState(matches[0]?.id ?? "");
  const [selectedConversationId, setSelectedConversationId] = useState(
    conversations[0]?.id ?? "",
  );
  const [conversationNotes, setConversationNotes] = useState("");
  const [conversationFocus, setConversationFocus] =
    useState<(typeof focusOptions)[number]["value"]>("warm");
  const [safetyContent, setSafetyContent] = useState("");
  const [safetyContentType, setSafetyContentType] =
    useState<(typeof contentTypes)[number]["value"]>("message");
  const [profileResult, setProfileResult] =
    useState<AIProfileCoachOutput | null>(null);
  const [matchResult, setMatchResult] = useState<AIMatchCoachOutput | null>(
    null,
  );
  const [conversationResult, setConversationResult] =
    useState<AIConversationCoachOutput | null>(null);
  const [safetyResult, setSafetyResult] = useState<AISafetyCheckOutput | null>(
    null,
  );
  const interestText = useMemo(
    () =>
      onboarding?.interests
        .map((interest) => interestLabels[interest as Interest])
        .join(", ") ?? "",
    [onboarding?.interests],
  );

  async function runProfileCoach() {
    await runAIAction({
      action: "profile",
      body: {
        bio: bioDraft,
        interests: onboarding?.interests ?? [],
        prompts,
      },
      endpoint: "/api/ai/profile-coach",
      onResult: setProfileResult,
    });
  }

  async function runMatchCoach() {
    await runAIAction({
      action: "match",
      body: {
        notes: matchNotes,
        profileId: selectedMatchId || undefined,
      },
      endpoint: "/api/ai/match-coach",
      onResult: setMatchResult,
    });
  }

  async function runConversationCoach() {
    await runAIAction({
      action: "conversation",
      body: {
        conversationId: selectedConversationId || undefined,
        focus: conversationFocus,
        notes: conversationNotes,
      },
      endpoint: "/api/ai/conversation-coach",
      onResult: setConversationResult,
    });
  }

  async function runSafetyCheck() {
    await runAIAction({
      action: "safety",
      body: {
        content: safetyContent,
        contentType: safetyContentType,
      },
      endpoint: "/api/ai/safety-check",
      onResult: setSafetyResult,
    });
  }

  async function runAIAction<T>({
    action,
    body,
    endpoint,
    onResult,
  }: {
    action: Exclude<PendingAction, null>;
    body: Record<string, unknown>;
    endpoint: string;
    onResult: (value: T) => void;
  }) {
    setPendingAction(action);
    setError("");
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | (T & ApiErrorPayload)
        | null;

      if (!response.ok || !payload) {
        throw new Error(
          getFailureMessage(payload, "AI Companion could not respond."),
        );
      }

      onResult(payload as T);
      setMessage("AI Companion created an optional draft.");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "AI Companion could not respond.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied.");
      setError("");
    } catch {
      setError("Could not copy text.");
    }
  }

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
              People
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Sparkles size={16} />
              AI Companion
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Draft, explain, and check with a little more care.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              Suggestions stay optional. Nothing is posted, saved, or sent
              automatically.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[#cbd4c6] bg-white px-4 text-sm font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
              href="/profile/edit"
            >
              Edit profile
            </Link>
            <Link
              className="flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
              href="/messages"
            >
              Chats
            </Link>
          </div>
        </header>

        {message ? <Notice message={message} tone="success" /> : null}
        {error ? <Notice message={error} tone="error" /> : null}

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <Panel
            actionLabel="Improve profile"
            busy={pendingAction === "profile"}
            icon={UserRound}
            onAction={runProfileCoach}
            title="Profile Coach"
          >
            <label className="block">
              <span className="text-sm font-semibold text-[#34443a]">Bio</span>
              <textarea
                className="mt-2 min-h-32 w-full rounded-md border border-[#cbd4c6] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#17251f]"
                maxLength={1000}
                onChange={(event) => setBioDraft(event.target.value)}
                value={bioDraft}
              />
            </label>
            <p className="mt-3 rounded-md border border-[#e2e6dc] bg-[#fbfaf4] px-3 py-2 text-sm text-[#34443a]">
              Current interests: {interestText || "Not added yet"}
            </p>
            {profileResult ? (
              <ResultBlock
                onCopy={copyText}
                sections={[
                  ["Improved bio", profileResult.improvedBio],
                  [
                    "Prompt drafts",
                    profileResult.improvedPrompts
                      .map(
                        (prompt) => `${prompt.promptText}\n${prompt.answer}`,
                      )
                      .join("\n\n"),
                  ],
                  [
                    "Suggested interests",
                    profileResult.suggestedInterests.join(", "),
                  ],
                  ["Notes", profileResult.notes.join("\n")],
                ]}
              />
            ) : null}
          </Panel>

          <Panel
            actionLabel="Explain match"
            busy={pendingAction === "match"}
            icon={Heart}
            onAction={runMatchCoach}
            title="Match Coach"
          >
            <Select
              label="People match"
              onChange={setSelectedMatchId}
              options={matches.map((match) => ({
                label: `${match.name} - ${match.match}%`,
                value: match.id,
              }))}
              placeholder="Use notes only"
              value={selectedMatchId}
            />
            <textarea
              className="mt-3 min-h-24 w-full rounded-md border border-[#cbd4c6] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#17251f]"
              maxLength={1000}
              onChange={(event) => setMatchNotes(event.target.value)}
              placeholder="Optional match context"
              value={matchNotes}
            />
            {matchResult ? (
              <ResultBlock
                onCopy={copyText}
                sections={[
                  ["Explanation", matchResult.explanation],
                  [
                    "Breakdown",
                    matchResult.scoreBreakdownNotes
                      .map((item) => `${item.area}: ${item.note}`)
                      .join("\n"),
                  ],
                  [
                    "Questions to explore",
                    matchResult.questionsToExplore.join("\n"),
                  ],
                ]}
              />
            ) : null}
          </Panel>

          <Panel
            actionLabel="Suggest starters"
            busy={pendingAction === "conversation"}
            icon={MessageCircle}
            onAction={runConversationCoach}
            title="Conversation Coach"
          >
            <Select
              label="Conversation"
              onChange={setSelectedConversationId}
              options={conversations.map((conversation) => ({
                label:
                  conversation.otherParticipants[0]?.name ?? "Conversation",
                value: conversation.id,
              }))}
              placeholder="Use notes only"
              value={selectedConversationId}
            />
            <Select
              label="Tone"
              onChange={(value) =>
                setConversationFocus(
                  value as (typeof focusOptions)[number]["value"],
                )
              }
              options={[...focusOptions]}
              value={conversationFocus}
            />
            <textarea
              className="mt-3 min-h-24 w-full rounded-md border border-[#cbd4c6] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#17251f]"
              maxLength={1000}
              onChange={(event) => setConversationNotes(event.target.value)}
              placeholder="Optional conversation context"
              value={conversationNotes}
            />
            {conversationResult ? (
              <ResultBlock
                onCopy={copyText}
                sections={[
                  [
                    "Conversation starters",
                    conversationResult.conversationStarters.join("\n"),
                  ],
                  ["Icebreakers", conversationResult.icebreakers.join("\n")],
                  ["Notes", conversationResult.notes.join("\n")],
                ]}
              />
            ) : null}
          </Panel>

          <Panel
            actionLabel="Check safety"
            busy={pendingAction === "safety"}
            icon={ShieldCheck}
            onAction={runSafetyCheck}
            title="AI Safety"
          >
            <Select
              label="Content type"
              onChange={(value) =>
                setSafetyContentType(
                  value as (typeof contentTypes)[number]["value"],
                )
              }
              options={[...contentTypes]}
              value={safetyContentType}
            />
            <textarea
              className="mt-3 min-h-32 w-full rounded-md border border-[#cbd4c6] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#17251f]"
              maxLength={2000}
              onChange={(event) => setSafetyContent(event.target.value)}
              placeholder="Paste text to check"
              value={safetyContent}
            />
            {safetyResult ? (
              <ResultBlock
                onCopy={copyText}
                sections={[
                  ["Risk", safetyResult.riskLevel],
                  [
                    "Categories",
                    [
                      `Spam: ${safetyResult.categories.spam ? "yes" : "no"}`,
                      `Harassment: ${
                        safetyResult.categories.harassment ? "yes" : "no"
                      }`,
                      `Scam: ${safetyResult.categories.scam ? "yes" : "no"}`,
                    ].join("\n"),
                  ],
                  ["Explanation", safetyResult.explanation],
                  ["Recommendation", safetyResult.recommendation],
                ]}
              />
            ) : null}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({
  actionLabel,
  busy,
  children,
  icon: Icon,
  onAction,
  title,
}: {
  actionLabel: string;
  busy: boolean;
  children: ReactNode;
  icon: LucideIcon;
  onAction: () => void;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
          <Icon size={16} />
          {title}
        </p>
        <button
          className="flex h-10 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:opacity-60"
          disabled={busy}
          onClick={onAction}
          type="button"
        >
          {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Sparkles size={16} />}
          {actionLabel}
        </button>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Select({
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="text-sm font-semibold text-[#34443a]">{label}</span>
      <select
        className="mt-2 h-11 w-full rounded-md border border-[#cbd4c6] bg-white px-3 text-sm font-semibold text-[#17201b] outline-none transition focus:border-[#17251f]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResultBlock({
  onCopy,
  sections,
}: {
  onCopy: (value: string) => void;
  sections: Array<[string, string]>;
}) {
  return (
    <div className="mt-4 space-y-3">
      {sections
        .filter(([, value]) => value.trim())
        .map(([label, value]) => (
          <div
            className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3"
            key={label}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#607265]">{label}</p>
              <button
                className="flex h-8 items-center justify-center gap-1 rounded-md border border-[#cbd4c6] bg-white px-2 text-xs font-semibold text-[#34443a] transition hover:bg-[#f3f0e6]"
                onClick={() => onCopy(value)}
                type="button"
              >
                <Copy size={13} />
                Copy
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#34443a]">
              {value}
            </p>
          </div>
        ))}
    </div>
  );
}

function Notice({
  message,
  tone,
}: {
  message: string;
  tone: "error" | "success";
}) {
  return (
    <p
      className={
        tone === "error"
          ? "mt-4 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]"
          : "mt-4 flex items-center gap-2 rounded-md border border-[#94c973] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f36]"
      }
    >
      {tone === "success" ? <Check size={15} /> : null}
      {message}
    </p>
  );
}

function getFailureMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const actionPayload = payload as ApiErrorPayload;
  const firstIssue = actionPayload.issues?.[0]?.message;

  return [actionPayload.error, firstIssue].filter(Boolean).join(" ") || fallback;
}
