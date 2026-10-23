import { systemHealth } from "@/lib/super-admin-data";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function SystemHealth() {
  return (
    <Card>
      <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
      <CardContent>
      <ul className="space-y-3">
        {systemHealth.map((s) => {
          const ok = s.status === "Operational";
          return (
            <li key={s.name} className="flex items-center gap-3 text-sm">
              <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="flex-1 text-slate-700">{s.name}</span>
              <Badge variant={ok ? "success" : "warning"} hasDot>{s.status}</Badge>
            </li>
          );
        })}
      </ul>
      </CardContent>
    </Card>
  );
}
