import Link from "next/link";
import { backendFetch } from "@/lib/api";
import { formatAction, formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import PageBody from "@/components/layout/PageBody";
import PageHeader from "@/components/layout/PageHeader";
import { tableStyles as t } from "@/components/shared/table";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 25;

type AuditRow = { id: number; actor_username: string | null; action: string; target: string; created_at: string };
type AuditPage = { count: number; results: AuditRow[] };

const pageLink =
  "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const requested = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(requested) && requested > 0 ? requested : 1;

  const first = await backendFetch<AuditPage>(`/api/superadmin/audit-log/?page_size=${PAGE_SIZE}&page=1`);
  const totalPages = Math.max(1, Math.ceil(first.count / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const data =
    current === 1 ? first : await backendFetch<AuditPage>(`/api/superadmin/audit-log/?page_size=${PAGE_SIZE}&page=${current}`);

  return (
    <PageBody>
      <PageHeader title="Audit log" description="Every change made in the dashboard: who did what, and when." />

      <Card className="overflow-hidden">
        <div className={t.wrapper}>
          <table className={t.table}>
            <thead>
              <tr className={t.headRow}>
                <th scope="col" className={t.th}>When</th>
                <th scope="col" className={t.th}>Who</th>
                <th scope="col" className={t.th}>Action</th>
                <th scope="col" className={t.th}>Target</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((row) => (
                <tr key={row.id} className={t.row}>
                  <td className={`${t.td} whitespace-nowrap text-slate-500 dark:text-slate-400`}>{formatDateTime(row.created_at)}</td>
                  <td className={t.tdStrong}>{row.actor_username ?? "System"}</td>
                  <td className={t.td}>{formatAction(row.action)}</td>
                  <td className={t.td}>{row.target || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.results.length === 0 && <p className={t.empty}>No admin activity yet.</p>}
        </div>
        {totalPages > 1 && (
          <nav aria-label="Audit log pages" className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page {current} of {totalPages} · {first.count.toLocaleString("en")} entries
            </p>
            <div className="flex gap-2">
              {current > 1 && (
                <Link href={`/super_admin/audit-logs?page=${current - 1}`} className={pageLink}>
                  Previous
                </Link>
              )}
              {current < totalPages && (
                <Link href={`/super_admin/audit-logs?page=${current + 1}`} className={pageLink}>
                  Next
                </Link>
              )}
            </div>
          </nav>
        )}
      </Card>
    </PageBody>
  );
}
