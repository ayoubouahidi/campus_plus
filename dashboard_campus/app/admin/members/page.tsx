import { backendFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import PageBody from "@/components/layout/PageBody";
import PageHeader from "@/components/layout/PageHeader";
import { tableStyles as t } from "@/components/shared/table";

export const metadata = { title: "Board team" };

type TeamMember = {
  id: number;
  name: string;
  email: string;
  joined_date: string | null;
  status: "active" | "inactive";
};

export default async function BoardTeamPage() {
  const team = await backendFetch<TeamMember[]>("/api/board/members/");
  return (
    <PageBody>
      <PageHeader
        title="Board team"
        description="People who manage this club in the dashboard. A Campus Hub administrator adds or removes board members."
      />
      <Card className="overflow-hidden">
        <div className={t.wrapper}>
          <table className={t.table}>
            <thead>
              <tr className={t.headRow}>
                <th scope="col" className={t.th}>Member</th>
                <th scope="col" className={t.th}>Email</th>
                <th scope="col" className={t.th}>On Campus Hub since</th>
                <th scope="col" className={t.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.id} className={t.row}>
                  <td className={t.td}>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size="sm" />
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{member.name}</span>
                    </div>
                  </td>
                  <td className={t.td}>{member.email || "—"}</td>
                  <td className={`${t.td} whitespace-nowrap`}>{formatDateTime(member.joined_date)}</td>
                  <td className={t.td}>
                    <Badge variant={member.status === "active" ? "success" : "danger"} hasDot>
                      {member.status === "active" ? "Active" : "Deactivated"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {team.length === 0 && <p className={t.empty}>No board members yet.</p>}
        </div>
      </Card>
    </PageBody>
  );
}
