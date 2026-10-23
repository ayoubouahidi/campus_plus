import { roleAssignments, roleStyles, tenantStyles } from "@/lib/super-admin-data";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function RoleAssignments() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent Role Assignments</CardTitle>
        <Button variant="ghost" size="sm">Manage roles</Button>
      </CardHeader>

      <CardContent className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500">
            <th className="rounded-l-lg px-3 py-2.5 font-medium">User</th>
            <th className="px-3 py-2.5 font-medium">Role</th>
            <th className="px-3 py-2.5 font-medium">Tenant</th>
            <th className="rounded-r-lg px-3 py-2.5 font-medium">Assigned</th>
          </tr>
        </thead>
        <tbody>
          {roleAssignments.map((r) => (
            <tr key={r.name} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={r.name} size="xs" />
                  <span className="font-semibold text-slate-900">{r.name}</span>
                </div>
              </td>
              <td className="px-3 py-3">
                <Badge variant="neutral" className={roleStyles[r.role]}>
                  {r.role}
                </Badge>
              </td>
              <td className="px-3 py-3">
                <Badge variant="neutral" className={tenantStyles[r.tenant]}>
                  {r.tenant}
                </Badge>
              </td>
              <td className="px-3 py-3 text-slate-600">{r.assigned}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </CardContent>
    </Card>
  );
}
