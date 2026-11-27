import Link from "next/link";
import { backendFetch } from "@/lib/api";
import { formatAction, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import PageBody from "@/components/layout/PageBody";
import AutoRefresh from "@/components/shared/AutoRefresh";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/shared/StatCard";

export const metadata = { title: "Overview" };

type SuperStats = { total_users: number; total_clubs: number; events_this_month: number };
type Organization = { id: number; name: string; is_active: boolean };
type RoleRow = { role: string; count: number };
type AuditRow = { id: number; actor_username: string | null; action: string; target: string; created_at: string };
type Paginated<T> = { count: number; results: T[] };

const linkClass =
  "rounded text-sm font-semibold text-violet-600 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-400";

export default async function SuperAdminOverviewPage() {
  const [stats, organizations, roles, audit] = await Promise.all([
    backendFetch<SuperStats>("/api/superadmin/stats/"),
    backendFetch<Paginated<Organization>>("/api/superadmin/organizations/?page_size=200"),
    backendFetch<RoleRow[]>("/api/superadmin/roles/distribution/"),
    backendFetch<Paginated<AuditRow>>("/api/superadmin/audit-log/?page_size=6"),
  ]);

  const roleCount = (role: string) => roles.find((row) => row.role === role)?.count ?? 0;
  const activeOrganizations = organizations.results.filter((organization) => organization.is_active).length;

  return (
    <PageBody>
      <AutoRefresh />
      <PageHeader title="Overview" description="Campus Hub at 1337: organizations, accounts and recent admin activity." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={stats.total_users.toLocaleString("en")} note={`${roleCount("STUDENT")} students`} />
        <StatCard label="Organizations" value={String(stats.total_clubs)} note={`${activeOrganizations} active`} />
        <StatCard label="Board members" value={String(roleCount("BOARD_MEMBER"))} note={`${roleCount("SUPERADMIN")} super admins`} />
        <StatCard label="Events this month" value={String(stats.events_this_month)} note="Started since the 1st" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Organizations</CardTitle>
            <Link href="/super_admin/organizations" className={linkClass}>
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            {organizations.results.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No organizations yet. <Link href="/super_admin/organizations" className={linkClass}>Create the first one</Link>.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {organizations.results.slice(0, 6).map((organization) => (
                  <li key={organization.id} className="flex items-center justify-between gap-3 py-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{organization.name}</p>
                    <Badge variant={organization.is_active ? "success" : "neutral"} hasDot>
                      {organization.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Recent activity</CardTitle>
            <Link href="/super_admin/audit-logs" className={linkClass}>
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {audit.results.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No admin activity yet.</p>
            ) : (
              <ul className="space-y-4">
                {audit.results.map((row) => (
                  <li key={row.id} className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{formatAction(row.action)}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {row.target || "—"} · {row.actor_username ?? "System"} · {formatDateTime(row.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
