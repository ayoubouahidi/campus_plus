import { auditLog as mockAuditLog } from "@/lib/super-admin-data";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function AuditLog({
  auditRows,
}: {
  auditRows?: {
    id: number;
    actor_username: string | null;
    action: string;
    target: string;
    created_at: string;
  }[];
}) {
  const rows =
    auditRows && auditRows.length > 0
      ? auditRows.map((row) => ({
          initials: (row.actor_username || "SYS").slice(0, 2).toUpperCase(),
          title: row.action.replaceAll("_", " "),
          detail: `${row.target}${row.created_at ? ` • ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}` : ""}`,
        }))
      : mockAuditLog;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Audit Log</CardTitle>
        <Button variant="ghost" size="sm">View all</Button>
      </CardHeader>
      <CardContent>
      <ul className="space-y-4">
        {rows.map((a) => (
          <li key={a.title} className="flex items-center gap-3">
            <Avatar name={a.initials} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{a.title}</p>
              <p className="truncate text-xs text-slate-500">{a.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      </CardContent>
    </Card>
  );
}
