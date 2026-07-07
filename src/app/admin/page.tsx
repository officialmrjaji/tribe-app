import {
  BarChart3,
  CreditCard,
  Flag,
  Gauge,
  Megaphone,
  Mic,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { getAdminDashboard, requireAdminAccess } from "@/lib/admin/service";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let admin;
  let dashboard;

  try {
    admin = await requireAdminAccess();
    dashboard = await getAdminDashboard({ query: q });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/sign-in");
    }

    if (error instanceof ApiError && error.status === 403) {
      return <AdminAccessDenied message={error.message} />;
    }

    throw error;
  }

  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-[#d8ded1] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              className="text-sm font-semibold text-[#607265] transition hover:text-[#17251f]"
              href="/settings"
            >
              Settings
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#607265]">
              <ShieldCheck size={16} />
              Admin
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              Production operations
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#34443a]">
              Operational visibility for users, reports, verification,
              moderation, payments, voice rooms, analytics, feature flags, and
              announcements.
            </p>
          </div>
          <div className="rounded-md border border-[#d8ded1] bg-white px-4 py-3 text-sm text-[#34443a] shadow-sm">
            <p className="font-semibold text-[#17201b]">
              {admin.clerkUser.fullName ?? admin.clerkUser.username ?? "Admin"}
            </p>
            <p className="mt-1 uppercase text-[#607265]">{admin.role}</p>
          </div>
        </header>

        <section className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric icon={Users} label="Users" value={dashboard.overview.users} />
          <Metric
            icon={UserCheck}
            label="Profiles"
            value={dashboard.overview.profiles}
          />
          <Metric
            icon={ShieldAlert}
            label="Open reports"
            value={dashboard.overview.openReports}
          />
          <Metric
            icon={CreditCard}
            label="Subscriptions"
            value={dashboard.overview.activeSubscriptions}
          />
          <Metric
            icon={Gauge}
            label="Boosts"
            value={dashboard.overview.activeBoosts}
          />
          <Metric
            icon={Mic}
            label="Voice rooms"
            value={dashboard.overview.openVoiceRooms}
          />
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Panel icon={Search} title="User search">
            <form className="flex gap-2" method="get">
              <input
                className="min-w-0 flex-1 rounded-md border border-[#d8ded1] bg-[#fbfaf4] px-3 py-2 text-sm outline-none transition focus:border-[#607265] focus:ring-2 focus:ring-[#94c973]/30"
                defaultValue={q ?? ""}
                name="q"
                placeholder="Search by email"
              />
              <button className="rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]">
                Search
              </button>
            </form>
            <div className="mt-4 space-y-2">
              {dashboard.users.map((user) => (
                <div
                  className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3"
                  key={user.id}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">{user.email}</p>
                      <p className="text-xs text-[#607265]">
                        {user.profile?.display_name ?? "Profile name pending"}
                      </p>
                    </div>
                    <p className="text-xs font-semibold uppercase text-[#607265]">
                      {user.moderation_status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel icon={BarChart3} title="Analytics overview">
            <div className="grid gap-2 sm:grid-cols-2">
              <MiniMetric
                label="DAU"
                value={dashboard.analytics.dailyActiveUsers}
              />
              <MiniMetric
                label="MAU"
                value={dashboard.analytics.monthlyActiveUsers}
              />
              <MiniMetric
                label="Profile completion"
                suffix="%"
                value={dashboard.analytics.averageProfileCompletion}
              />
              <MiniMetric
                label="Like rate base"
                value={dashboard.analytics.saves7d}
              />
              <MiniMetric
                label="Match rate"
                suffix="%"
                value={dashboard.analytics.matchRate7d}
              />
              <MiniMetric
                label="Reply rate"
                suffix="%"
                value={dashboard.analytics.replyRate7d}
              />
              <MiniMetric
                label="Voice usage"
                value={dashboard.analytics.voiceUsage7d}
              />
              <MiniMetric
                label="Square usage"
                value={dashboard.analytics.squareUsage7d}
              />
            </div>
          </Panel>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <QueuePanel
            empty="No active profile, message, or Square reports."
            icon={ShieldAlert}
            items={dashboard.reports.map((report) => ({
              meta: `${report.source} / ${String(report.status)}`,
              title: String(report.reason),
            }))}
            title="Reports queue"
          />
          <QueuePanel
            empty="No verification items are waiting."
            icon={UserCheck}
            items={dashboard.verificationQueue.map((profile) => ({
              meta: `Profile ${String(profile.id).slice(0, 8)}`,
              title: String(profile.display_name ?? "Unnamed member"),
            }))}
            title="Verification queue"
          />
          <QueuePanel
            empty="No moderation cases are open."
            icon={Flag}
            items={dashboard.moderationQueue.map((item) => ({
              meta: `${String(item.status)} / ${String(item.priority)}`,
              title: String(item.reason),
            }))}
            title="Moderation queue"
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <QueuePanel
            empty="No recent payments."
            icon={CreditCard}
            items={dashboard.payments.map((payment) => ({
              meta: `${String(payment.status)} / ${String(payment.product_type)}`,
              title: String(payment.plan_code),
            }))}
            title="Payments overview"
          />
          <QueuePanel
            empty="No recent voice rooms."
            icon={Mic}
            items={dashboard.voiceRooms.map((room) => ({
              meta: `${String(room.room_type)} / ${String(room.status)}`,
              title: String(room.title),
            }))}
            title="Voice rooms overview"
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <Panel icon={Flag} title="Feature flags">
            <div className="space-y-2">
              {dashboard.featureFlags.map((flag) => (
                <div
                  className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3"
                  key={String(flag.key)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{String(flag.name)}</p>
                    <p className="text-xs font-semibold uppercase text-[#607265]">
                      {flag.enabled ? "Enabled" : "Off"} /{" "}
                      {String(flag.rollout_percentage)}%
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#607265]">
                    {String(flag.description ?? "")}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel icon={Megaphone} title="Announcements">
            {dashboard.announcements.length ? (
              <div className="space-y-2">
                {dashboard.announcements.map((announcement) => (
                  <div
                    className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3"
                    key={String(announcement.id)}
                  >
                    <p className="text-sm font-semibold">
                      {String(announcement.title)}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase text-[#607265]">
                      {String(announcement.status)} /{" "}
                      {String(announcement.audience)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-[#34443a]">
                Announcements created by admins will appear here.
              </p>
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function AdminAccessDenied({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#17201b] sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center">
        <section className="w-full rounded-lg border border-[#d8ded1] bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
            <ShieldAlert size={16} />
            Admin access
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            This account is not configured as an admin
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#34443a]">{message}</p>
          <p className="mt-3 text-sm leading-6 text-[#34443a]">
            Ask an owner to add this account to the admin allowlist or admin
            role settings, then restart the local server if access was just
            changed.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              className="flex h-10 items-center justify-center rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32]"
              href="/settings"
            >
              Back to settings
            </Link>
            <Link
              className="flex h-10 items-center justify-center rounded-md border border-[#d8ded1] px-4 text-sm font-semibold text-[#17251f] transition hover:border-[#9dad9f] hover:bg-[#fbfaf4]"
              href="/"
            >
              Open discovery
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase text-[#607265]">
        <Icon size={15} />
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function MiniMetric({
  label,
  suffix = "",
  value,
}: {
  label: string;
  suffix?: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3">
      <p className="text-xs font-semibold uppercase text-[#607265]">{label}</p>
      <p className="mt-1 text-xl font-semibold">
        {value}
        {suffix}
      </p>
    </div>
  );
}

function Panel({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof Users;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[#d8ded1] bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#607265]">
        <Icon size={16} />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function QueuePanel({
  empty,
  icon,
  items,
  title,
}: {
  empty: string;
  icon: typeof Users;
  items: Array<{ meta: string; title: string }>;
  title: string;
}) {
  return (
    <Panel icon={icon} title={title}>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              className="rounded-md border border-[#e2e6dc] bg-[#fbfaf4] p-3"
              key={`${item.title}-${index}`}
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs font-semibold uppercase text-[#607265]">
                {item.meta}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-[#34443a]">{empty}</p>
      )}
    </Panel>
  );
}
