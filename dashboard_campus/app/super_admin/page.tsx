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

export default async function SuperAdminOverviewPage() {
  let statsData: SuperStats | null = null;
  let organizations: Organization[] = [];
  let roles: RoleRow[] = [];
  let weeklyEvents: WeeklyEvent[] = [];
  let auditRows: AuditRow[] = [];

  try {
    const [statsResponse, organizationsResponse, rolesResponse, weeklyResponse, auditResponse] =
      await Promise.all([
        backendFetch<SuperStats>("/api/superadmin/stats/"),
        backendFetch<{ results: Organization[] } | Organization[]>("/api/superadmin/organizations/"),
        backendFetch<RoleRow[]>("/api/superadmin/roles/distribution/"),
        backendFetch<WeeklyEvent[]>("/api/superadmin/events/weekly/"),
        backendFetch<{ results: AuditRow[] } | AuditRow[]>("/api/superadmin/audit-log/?page=1&page_size=5"),
      ]);
    statsData = statsResponse;
    organizations = Array.isArray(organizationsResponse)
      ? organizationsResponse
      : organizationsResponse.results;
    roles = rolesResponse;
    weeklyEvents = weeklyResponse;
    auditRows = Array.isArray(auditResponse) ? auditResponse : auditResponse.results;
  } catch {
    // Keep the dashboard usable when the backend is temporarily unavailable.
  }

  const platformStats = [
    { label: "Total Users", value: (statsData?.total_users ?? 0).toLocaleString(), note: "Registered users", tone: "good" as const },
    { label: "Organizations", value: String(statsData?.total_clubs ?? 0), note: "Active and suspended clubs", tone: "neutral" as const },
    { label: "Events This Month", value: String(statsData?.events_this_month ?? 0), note: "Current month", tone: "good" as const },
    { label: "Pending Approvals", value: String(statsData?.pending_requests ?? 0), note: "Membership requests", tone: "warn" as const },
  ];

  return (
    <>
      <Topbar
        title="Platform Overview"
        subtitle="All tenants • UM6P Ben Guerir Campus"
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
            <RoleAssignments />
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
