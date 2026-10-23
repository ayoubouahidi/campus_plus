import { auditLog } from "@/lib/super-admin-data";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function AuditLog() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Audit Log</CardTitle>
        <Button variant="ghost" size="sm">View all</Button>
      </CardHeader>
      <CardContent>
      <ul className="space-y-4">
        {auditLog.map((a) => (
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
