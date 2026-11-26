import Topbar from "@/components/admin/Topbar";
import StatCard from "@/components/admin/StatCard";
import OrganizationsTable from "@/components/super-admin/OrganizationsTable";
import RoleAssignments from "@/components/super-admin/RoleAssignments";
import ActivityChart from "@/components/super-admin/ActivityChart";
import RoleDistribution from "@/components/super-admin/RoleDistribution";
import SystemHealth from "@/components/super-admin/SystemHealth";
import AuditLog from "@/components/super-admin/AuditLog";
import { backendFetch } from "@/lib/api";

export const instant = false;

type SuperStats = {
  total_users: number;
  total_clubs: number;
  events_this_month: number;
  pending_requests: number;
};

type Organization = {
  id: number;
  name: string;
  department_name: string | null;
  is_active: boolean;
};

type RoleRow = { role: string; count: number };
type WeeklyEvent = { week_start: string; events: number };
type AuditRow = {
  id: number;
  actor_username: string | null;
  action: string;
  target: string;
  created_at: string;
};
type UserRow = {
  id: number;
  username: string;
  role: string;
  club_name: string | null;
};

export default async function SuperAdminOverviewPage() {
  const [statsData, organizationsResponse, roles, weeklyEvents, auditResponse, usersResponse] =
    await Promise.all([
      backendFetch<SuperStats>("/api/superadmin/stats/"),
      backendFetch<{ results: Organization[] } | Organization[]>("/api/superadmin/organizations/"),
      backendFetch<RoleRow[]>("/api/superadmin/roles/distribution/"),
      backendFetch<WeeklyEvent[]>("/api/superadmin/events/weekly/"),
      backendFetch<{ results: AuditRow[] } | AuditRow[]>("/api/superadmin/audit-log/?page=1&page_size=5"),
      backendFetch<{ results: UserRow[] }>("/api/superadmin/users/?page=1&page_size=5"),
    ]);
  const organizations = Array.isArray(organizationsResponse)
    ? organizationsResponse
    : organizationsResponse.results;
  const auditRows = Array.isArray(auditResponse) ? auditResponse : auditResponse.results;

  const platformStats = [
    { label: "Total Users", value: statsData.total_users.toLocaleString(), note: "Registered users", tone: "good" as const },
    { label: "Organizations", value: String(statsData.total_clubs), note: "Active and suspended clubs", tone: "neutral" as const },
    { label: "Events This Month", value: String(statsData.events_this_month), note: "Current month", tone: "good" as const },
    { label: "Pending Approvals", value: String(statsData.pending_requests), note: "Membership requests", tone: "warn" as const },
  ];

  return (
    <>
      <Topbar
        title="Platform Overview"
        subtitle="1337 campus platform"
      />

      <main className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {platformStats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <OrganizationsTable organizations={organizations} />
            <RoleAssignments users={usersResponse.results} />
            <ActivityChart weeklyEvents={weeklyEvents} />
          </div>
          <div className="space-y-6">
            <RoleDistribution roles={roles} />
            <SystemHealth />
            <AuditLog auditRows={auditRows} />
          </div>
        </div>
      </main>
    </>
  );
}
