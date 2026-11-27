import { backendFetch } from "@/lib/api";
import { formatShortDay } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import PageBody from "@/components/layout/PageBody";
import PageHeader from "@/components/layout/PageHeader";
import BarChart from "@/components/shared/BarChart";

export const metadata = { title: "Analytics" };

type WeeklyEvent = { week_start: string; events: number };
type RoleRow = { role: string; count: number };

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Students",
  BOARD_MEMBER: "Board members",
  SUPERADMIN: "Super admins",
};

export default async function AnalyticsPage() {
  const [weekly, roles] = await Promise.all([
    backendFetch<WeeklyEvent[]>("/api/superadmin/events/weekly/"),
    backendFetch<RoleRow[]>("/api/superadmin/roles/distribution/"),
  ]);
  const totalAccounts = roles.reduce((sum, row) => sum + row.count, 0);

  return (
    <PageBody>
      <PageHeader title="Analytics" description="How Campus Hub is used across 1337." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Events created per week</CardTitle>
            <CardDescription>Last weeks, newest on the right.</CardDescription>
          </CardHeader>
          <CardContent>
            {weekly.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No events created yet.</p>
            ) : (
              <BarChart
                caption="Events created per week"
                valueLabel="Events"
                data={weekly.map((row) => ({ label: formatShortDay(row.week_start), value: row.events }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accounts by role</CardTitle>
            <CardDescription>{totalAccounts.toLocaleString("en")} accounts in total.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {roles.map((row) => {
                const share = totalAccounts ? Math.round((row.count / totalAccounts) * 100) : 0;
                return (
                  <li key={row.role} className="space-y-1.5">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{ROLE_LABELS[row.role] ?? row.role}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{row.count.toLocaleString("en")}</span> · {share}%
                      </span>
                    </div>
                    <div aria-hidden="true" className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-2 rounded-full bg-violet-600 dark:bg-violet-500" style={{ width: `${Math.max(share, row.count ? 2 : 0)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
