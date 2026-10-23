import { roleDistribution } from "@/lib/super-admin-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function RoleDistribution() {
  return (
    <Card>
      <CardHeader><CardTitle>Role Distribution</CardTitle></CardHeader>
      <CardContent>
      <ul className="space-y-3">
        {roleDistribution.map((r) => (
          <li key={r.label} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 text-slate-600">{r.label}</span>
            <div className="h-1.5 flex-1 rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${r.color}`}
                style={{ width: `${r.width}%` }}
              />
            </div>
            <span className="w-12 text-right font-semibold text-slate-900">{r.count}</span>
          </li>
        ))}
      </ul>
      </CardContent>
    </Card>
  );
}
