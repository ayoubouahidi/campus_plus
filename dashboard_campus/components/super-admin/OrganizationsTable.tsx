import { organizations, tenantStyles, type OrgStatus } from "@/lib/super-admin-data";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const statusVariants: Record<OrgStatus, "success" | "warning" | "danger"> = {
  Active: "success",
  Pending: "warning",
  Suspended: "danger",
};

export default function OrganizationsTable() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Organizations</CardTitle>
        <Button variant="ghost" size="sm">Manage tenants</Button>
      </CardHeader>

      <CardContent className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500">
            <th className="rounded-l-lg px-3 py-2.5 font-medium">Organization</th>
            <th className="px-3 py-2.5 font-medium">Tenant</th>
            <th className="px-3 py-2.5 font-medium">Admins</th>
            <th className="px-3 py-2.5 font-medium">Events</th>
            <th className="rounded-r-lg px-3 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((o) => (
            <tr key={o.name} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-3.5 font-semibold text-slate-900">{o.name}</td>
              <td className="px-3 py-3.5">
                <Badge variant="neutral" className={tenantStyles[o.tenant]}>
                  {o.tenant}
                </Badge>
              </td>
              <td className="px-3 py-3.5 text-slate-600">{o.admins}</td>
              <td className="px-3 py-3.5 text-slate-600">{o.events}</td>
              <td className="px-3 py-3.5">
                <Badge variant={statusVariants[o.status]} hasDot>
                  {o.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </CardContent>
    </Card>
  );
}
