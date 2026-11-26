import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type UserRow = {
  id: number;
  username: string;
  role: string;
  club_name: string | null;
};

const roleStyles: Record<string, string> = {
  STUDENT: "bg-slate-100 text-slate-600",
  BOARD_MEMBER: "bg-blue-100 text-blue-600",
  SUPERADMIN: "bg-violet-100 text-violet-600",
};

export default function RoleAssignments({ users }: { users: UserRow[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent Role Assignments</CardTitle>
        <span className="text-xs text-slate-500">{users.length} users</span>
      </CardHeader>

      <CardContent className="overflow-x-auto">
        {users.length ? <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500">
              <th className="rounded-l-lg px-3 py-2.5 font-medium">User</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="rounded-r-lg px-3 py-2.5 font-medium">Club</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.username} size="xs" />
                    <span className="font-semibold text-slate-900">{user.username}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Badge variant="neutral" className={roleStyles[user.role] ?? "bg-slate-100 text-slate-600"}>
                    {user.role.replaceAll("_", " ")}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-slate-600">{user.club_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table> : <p className="text-sm text-slate-500">No user data available.</p>}
      </CardContent>
    </Card>
  );
}
