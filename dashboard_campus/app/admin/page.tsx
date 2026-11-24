import Topbar from "@/components/admin/Topbar";
import StatCard from "@/components/admin/StatCard";
import EventsTable from "@/components/admin/EventsTable";
import PendingApprovals from "@/components/admin/PendingApprovals";
import QuickActions from "@/components/admin/QuickActions";
import { backendFetch } from "@/lib/api";

export const instant = false;

type BoardStats = {
  total_events: number;
  active_members: number;
  pending_requests: number;
  registrations_this_month: number | null;
  registrations_last_month: number | null;
};

type MembershipRequest = {
  id: number;
  member_name: string;
  kind: string;
  note: string;
  status: string;
};

type ClubEvent = {
  id: number;
  name: string;
  starts_at: string | null;
  status: string;
  club: number | null;
};

export default async function OverviewPage() {
  const [statsData, requests, eventsResponse, club] = await Promise.all([
    backendFetch<BoardStats>("/api/board/stats/"),
    backendFetch<MembershipRequest[]>("/api/board/requests/"),
    backendFetch<ClubEvent[] | { results: ClubEvent[] }>("/api/club-events/"),
    backendFetch<{ id: number; name: string }>("/api/board/club/"),
  ]);
  const allEvents = Array.isArray(eventsResponse) ? eventsResponse : eventsResponse.results;
  const events = allEvents.filter((event) => event.club === club.id);

  const registrationsThisMonth = statsData.registrations_this_month;
  const registrationsLastMonth = statsData.registrations_last_month;
  const trend =
    registrationsThisMonth !== null && registrationsLastMonth !== null && registrationsLastMonth > 0
      ? ((registrationsThisMonth - registrationsLastMonth) / registrationsLastMonth) * 100
      : null;

  const stats = [
    {
      label: "Total Events",
      value: String(statsData?.total_events ?? 0),
      note: "Club events",
      tone: "good" as const,
    },
    {
      label: "Registrations",
      value: registrationsThisMonth === null ? "—" : registrationsThisMonth.toLocaleString(),
      note: registrationsThisMonth === null
        ? "Registration data not available"
        : trend === null ? "This month" : `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}% vs last month`,
      tone: trend !== null && trend < 0 ? ("warn" as const) : ("good" as const),
    },
    {
      label: "Active Members",
      value: String(statsData?.active_members ?? 0),
      note: "Club members",
      tone: "good" as const,
    },
    {
      label: "Pending Approvals",
      value: String(statsData?.pending_requests ?? 0),
      note: "Requests awaiting review",
      tone: "warn" as const,
    },
  ];

  return (
    <>
      <Topbar title="Club Overview" subtitle={`${club.name} • 1337`} />

      <main className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <EventsTable events={events} />
            {registrationsThisMonth === null && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Registration analytics are unavailable because the backend does not expose RSVP records yet.
              </p>
            )}
          </div>
          <div className="space-y-6">
            <PendingApprovals requests={requests} />
            <QuickActions />
          </div>
        </div>
      </main>
    </>
  );
}
