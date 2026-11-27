import Link from "next/link";
import { backendFetch } from "@/lib/api";
import { getBoardClub, getClubEvents } from "@/lib/board";
import { categoryLabel, eventPhase } from "@/lib/events";
import { formatDateTime, formatShortDay } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import PageBody from "@/components/layout/PageBody";
import AutoRefresh from "@/components/shared/AutoRefresh";
import PageHeader from "@/components/layout/PageHeader";
import BarChart from "@/components/shared/BarChart";
import StatCard from "@/components/shared/StatCard";

export const metadata = { title: "Overview" };

type BoardStats = {
  total_events: number;
  active_members: number;
  registrations_this_month: number | null;
  registrations_last_month: number | null;
};
type WeeklyRegistration = { date: string; registrations: number };

const linkClass =
  "rounded text-sm font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400";

async function loadOverview() {
  const club = await getBoardClub();
  const [stats, events, weekly] = await Promise.all([
    backendFetch<BoardStats>("/api/board/stats/"),
    getClubEvents(club),
    backendFetch<WeeklyRegistration[]>("/api/board/registrations/weekly/"),
  ]);
  return { club, stats, events, weekly, now: Date.now() };
}

function trendNote(thisMonth: number | null, lastMonth: number | null) {
  if (thisMonth === null || lastMonth === null) return "This month";
  if (lastMonth === 0) return `${lastMonth} last month`;
  const change = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  return `${change >= 0 ? "+" : ""}${change}% vs last month`;
}

export default async function BoardOverviewPage() {
  const { club, stats, events, weekly, now } = await loadOverview();
  const upcoming = events
    .filter((event) => eventPhase(event, now) === "upcoming")
    .sort((a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime());

  return (
    <PageBody>
      <AutoRefresh />
      <PageHeader
        title={club.name}
        description="Your club at a glance."
        actions={
          <Link
            href="/admin/events"
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
          >
            Manage events
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Upcoming events" value={String(upcoming.length)} note={`${stats.total_events} in total`} />
        <StatCard
          label="RSVPs this month"
          value={stats.registrations_this_month === null ? "—" : String(stats.registrations_this_month)}
          note={trendNote(stats.registrations_this_month, stats.registrations_last_month)}
        />
        <StatCard
          label="Going to upcoming events"
          value={String(upcoming.reduce((sum, event) => sum + event.rsvps_count, 0))}
          note="Students with an RSVP"
        />
        <StatCard label="Board team" value={String(stats.active_members)} note="Members managing this club" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Next events</CardTitle>
            <Link href="/admin/events" className={linkClass}>
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No upcoming events. <Link href="/admin/events" className={linkClass}>Publish one</Link>.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcoming.slice(0, 5).map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{event.name}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(event.starts_at)} · {categoryLabel(event.category)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{event.rsvps_count}</span>
                      {event.capacity ? ` / ${event.capacity}` : ""} going
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>RSVPs, last 7 days</CardTitle>
            <CardDescription>New RSVPs to your club&rsquo;s events per day.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              caption="RSVPs per day, last 7 days"
              valueLabel="RSVPs"
              data={weekly.map((row) => ({ label: formatShortDay(row.date), value: row.registrations }))}
            />
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
