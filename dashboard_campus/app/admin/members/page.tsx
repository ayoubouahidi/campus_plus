import Topbar from "@/components/admin/Topbar";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { members } from "@/lib/mock-data";

export default function MembersPage() {
  return (
    <>
      <Topbar title="Members" subtitle="Members of Robotics & AI Research Club" />

      <main className="p-6">
        {members.length > 0 ? (
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
                  {members.map((member) => (
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
