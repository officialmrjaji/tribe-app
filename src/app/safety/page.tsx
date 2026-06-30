import {
  ArrowLeft,
  EyeOff,
  FileWarning,
  Lock,
  ShieldCheck,
  Trash2,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOwnedProfile } from "@/lib/auth/owned-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type BlockedUserRow = {
  blocked_user_id: string;
  created_at: string;
  reason: string | null;
};

type PassedProfileRow = {
  created_at: string;
  passed_user_id: string;
};

type ReportRow = {
  created_at: string;
  id: string;
  reason: string;
  status: string;
};

export default async function SafetyPage() {
  const session = await getCurrentOwnedProfile();

  if ("error" in session) {
    redirect("/sign-in");
  }

  const userId = session.ownedProfile.account.id;
  const supabase = createSupabaseAdminClient();
  const [blockedResult, hiddenResult, reportsResult, messageReportsResult] =
    await Promise.all([
      supabase
        .from("blocked_users")
        .select("blocked_user_id, reason, created_at")
        .eq("blocker_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("passed_profiles")
        .select("passed_user_id, created_at")
        .eq("viewer_user_id", userId)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("reports")
        .select("id, reason, status, created_at")
        .eq("reporter_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("message_reports")
        .select("id, reason, status, created_at")
        .eq("reporter_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (blockedResult.error) {
    throw blockedResult.error;
  }

  if (hiddenResult.error) {
    throw hiddenResult.error;
  }

  if (reportsResult.error) {
    throw reportsResult.error;
  }

  if (messageReportsResult.error) {
    throw messageReportsResult.error;
  }

  const blockedUsers = (blockedResult.data ?? []) as BlockedUserRow[];
  const hiddenUsers = (hiddenResult.data ?? []) as PassedProfileRow[];
  const reports = [
    ...((reportsResult.data ?? []) as ReportRow[]),
    ...((messageReportsResult.data ?? []) as ReportRow[]),
  ].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/settings"
            >
              <ArrowLeft size={16} />
              Settings
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <ShieldCheck size={16} />
              Safety Center
            </p>
            <h1 className="mt-1 text-2xl font-semibold">
              Trust, privacy, and account safety
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#34443a]">
              Review blocked users, reports, hidden users, privacy controls, and
              delete-account confirmation. Destructive account deletion is not
              wired in this release.
            </p>
          </div>
          <Link
            className="flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
            href="/profile/edit"
          >
            Privacy controls
          </Link>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <SafetySummary
            icon={UserX}
            label="Blocked users"
            value={String(blockedUsers.length)}
          />
          <SafetySummary
            icon={EyeOff}
            label="Hidden users"
            value={String(hiddenUsers.length)}
          />
          <SafetySummary
            icon={FileWarning}
            label="Reports sent"
            value={String(reports.length)}
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <SafetyList
            emptyBody="Blocked users will appear here after you block a profile or conversation participant."
            icon={UserX}
            items={blockedUsers.map((row) => ({
              meta: formatDate(row.created_at),
              title: row.reason ?? "Blocked profile",
            }))}
            title="Blocked users"
          />
          <SafetyList
            emptyBody="Passed profiles are treated as hidden from your active discovery queue."
            icon={EyeOff}
            items={hiddenUsers.map((row) => ({
              meta: formatDate(row.created_at),
              title: "Hidden from discovery",
            }))}
            title="Hidden users"
          />
          <SafetyList
            emptyBody="Profile and message reports you submit will appear here for review tracking."
            icon={FileWarning}
            items={reports.map((row) => ({
              meta: `${row.status} / ${formatDate(row.created_at)}`,
              title: row.reason,
            }))}
            title="Reports"
          />
          <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <Lock size={16} />
              Privacy controls
            </p>
            <p className="mt-2 text-sm leading-6 text-[#34443a]">
              Manage discoverability, members-only visibility, private mode, and
              profile quality from your profile editor.
            </p>
            <Link
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
              href="/profile/edit"
            >
              Open profile privacy
            </Link>
          </section>
        </section>

        <section className="mt-6 rounded-lg border border-[#ef8f7a] bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#8a3325]">
            <Trash2 size={16} />
            Delete account
          </p>
          <p className="mt-2 text-sm leading-6 text-[#34443a]">
            This release includes confirmation only. Account deletion must be
            completed through a dedicated server flow with Clerk and Supabase
            cleanup before it becomes active.
          </p>
          <details className="mt-4 rounded-md border border-[#f0c0b4] bg-[#fff8f5] p-3">
            <summary className="cursor-pointer text-sm font-semibold text-[#8a3325]">
              I understand this would permanently remove my account
            </summary>
            <button
              className="mt-3 flex h-10 items-center justify-center rounded-md border border-[#ef8f7a] px-4 text-sm font-semibold text-[#8a3325] opacity-60"
              disabled
              type="button"
            >
              Delete account unavailable in this release
            </button>
          </details>
        </section>
      </div>
    </main>
  );
}

function SafetySummary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
        <Icon size={16} />
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-[#17201b]">{value}</p>
    </div>
  );
}

function SafetyList({
  emptyBody,
  icon: Icon,
  items,
  title,
}: {
  emptyBody: string;
  icon: typeof ShieldCheck;
  items: Array<{
    meta: string;
    title: string;
  }>;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
        <Icon size={16} />
        {title}
      </p>
      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <div
              className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] px-3 py-2"
              key={`${item.title}-${index}`}
            >
              <p className="text-sm font-semibold text-[#34443a]">
                {item.title}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase text-[#607265]">
                {item.meta}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[#34443a]">{emptyBody}</p>
      )}
    </section>
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
