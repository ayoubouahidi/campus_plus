import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function RoleDistribution({
  roles,
}: {
  roles: { role: string; count: number }[];
}) {
  const colors: Record<string, string> = {
    STUDENT: "bg-violet-600",
    BOARD_MEMBER: "bg-blue-600",
    ADMIN: "bg-fuchsia-500",
    SUPERADMIN: "bg-rose-500",
  };
  const labels: Record<string, string> = {
    STUDENT: "Students",
    BOARD_MEMBER: "Club Admins",
    ADMIN: "Admins",
    SUPERADMIN: "Super Admins",
  };
  const rows = roles.map((item) => ({
          label: labels[item.role] || item.role,
          count: String(item.count),
          width: 100,
          color: colors[item.role] || "bg-slate-500",
        }));
  const max = Math.max(1, ...rows.map((row) => Number(row.count)));
  const normalizedRows = rows.map((row) => ({ ...row, width: (Number(row.count) / max) * 100 }));

  return (
    <Card>
      <CardHeader><CardTitle>Role Distribution</CardTitle></CardHeader>
      <CardContent>
      {rows.length === 0 ? <p className="text-sm text-slate-500">No role data available.</p> : (
      <ul className="space-y-3">
        {normalizedRows.map((r) => (
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
      )}
      </CardContent>
    </Card>
  );
}
