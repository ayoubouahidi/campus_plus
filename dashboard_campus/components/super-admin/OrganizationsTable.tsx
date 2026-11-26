import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type OrgStatus = "Active" | "Pending" | "Suspended";
const statusVariants: Record<OrgStatus, "success" | "warning" | "danger"> = {
  Active: "success",
  Pending: "warning",
  Suspended: "danger",
};

type Organization = {
  id: number;
  name: string;
  department_name: string | null;
  is_active: boolean;
};

export default function OrganizationsTable({ organizations }: { organizations?: Organization[] }) {
  const rows =
    organizations && organizations.length > 0
      ? organizations.slice(0, 8).map((organization) => ({
          name: organization.name,
          department: organization.department_name || "—",
          status: (organization.is_active ? "Active" : "Suspended") as OrgStatus,
        }))
      : [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Organizations</CardTitle>
        <span className="text-xs text-slate-500">{rows.length} clubs</span>
      </CardHeader>

      <CardContent className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500">
            <th className="rounded-l-lg px-3 py-2.5 font-medium">Organization</th>
            <th className="px-3 py-2.5 font-medium">Department</th>
            <th className="rounded-r-lg px-3 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.name} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-3.5 font-semibold text-slate-900">{o.name}</td>
              <td className="px-3 py-3.5 text-slate-600">{o.department}</td>
              <td className="px-3 py-3.5">
                <Badge variant={statusVariants[o.status]} hasDot>
                  {o.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-5 text-center text-sm text-slate-500">No clubs available.</p>}
      </CardContent>
    </Card>
  );
}
