import Topbar from "@/components/admin/Topbar";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { backendFetch } from "@/lib/api";

export const instant = false;

type Member = {
  id: number;
  name: string;
  role: string;
  joined_date: string;
  status: "active" | "inactive";
};

export default async function MembersPage() {
  const [members, club] = await Promise.all([
    backendFetch<Member[]>("/api/board/members/"),
    backendFetch<{ name: string }>("/api/board/club/"),
  ]);
  const rows = members.map((member) => ({
    name: member.name,
    role: member.role,
    joined: member.joined_date
      ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(member.joined_date))
      : "Unknown",
    status: member.status === "active" ? "Active" : "Inactive",
  }));

  return (
    <>
      <Topbar title="Members" subtitle={`Members of ${club.name}`} />

      <main className="p-6">
        {rows.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Club members</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500">
                    <th className="rounded-l-lg px-3 py-2.5 font-medium">Member</th>
                    <th className="px-3 py-2.5 font-medium">Role</th>
                    <th className="px-3 py-2.5 font-medium">Joined</th>
                    <th className="rounded-r-lg px-3 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((member) => (
                    <tr key={member.name} className="border-b border-slate-100 last:border-0">
                      <td className="flex items-center gap-3 px-3 py-3.5 font-semibold text-slate-900">
                        <Avatar name={member.name} size="sm" />
                        {member.name}
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">{member.role}</td>
                      <td className="px-3 py-3.5 text-slate-600">{member.joined}</td>
                      <td className="px-3 py-3.5 text-slate-600">{member.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-red-600">Member data is not available.</p>
        )}
      </main>
    </>
  );
}
