import Topbar from "@/components/admin/Topbar";
import StatCard from "@/components/admin/StatCard";
import EventsTable from "@/components/admin/EventsTable";
import RegistrationsChart from "@/components/admin/RegistrationsChart";
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

type WeeklyRegistration = { date: string; registrations: number };

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
};

export default async function OverviewPage() {
  let statsData: BoardStats | null = null;
  let weekly: WeeklyRegistration[] = [];
  let requests: MembershipRequest[] = [];
  let events: ClubEvent[] = [];

  try {
    const [statsResponse, weeklyResponse, requestsResponse, eventsResponse] =
      await Promise.all([
        backendFetch<BoardStats>("/api/board/stats/"),
        backendFetch<WeeklyRegistration[]>("/api/board/registrations/weekly/"),
        backendFetch<MembershipRequest[]>("/api/board/requests/"),
        backendFetch<ClubEvent[] | { results: ClubEvent[] }>("/api/club-events/"),
      ]);
    statsData = statsResponse;
    weekly = weeklyResponse;
    requests = requestsResponse;
    events = "results" in eventsResponse ? eventsResponse.results : eventsResponse;
  } catch {
    // Keep the dashboard usable when the backend is temporarily unavailable.
  }

  const registrationsThisMonth = statsData?.registrations_this_month ?? 0;
  const registrationsLastMonth = statsData?.registrations_last_month ?? 0;
  const trend =
    registrationsLastMonth > 0
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
      value: registrationsThisMonth.toLocaleString(),
      note: trend === null ? "This month" : `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}% vs last month`,
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
      <Topbar title="Club Overview" subtitle="Robotics & AI Research Club • 1337" />

      <main className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <EventsTable events={events} />
            <RegistrationsChart registrations={weekly} />
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
