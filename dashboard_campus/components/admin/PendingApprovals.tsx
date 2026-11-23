import { approvals as mockApprovals } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function PendingApprovals({
  requests,
}: {
  requests?: { id: number; member_name: string; kind: string; note: string }[];
}) {
  const rows =
    requests && requests.length > 0
      ? requests.slice(0, 5).map((request) => ({
          name: request.member_name,
          note: request.note || `${request.kind} request`,
        }))
      : mockApprovals;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Pending Approvals</CardTitle>
        <Button variant="ghost" size="sm">See all</Button>
      </CardHeader>

      <CardContent>
      <ul className="space-y-4">
        {rows.map((a) => (
          <li key={a.name} className="flex items-center gap-3">
            <Avatar name={a.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{a.name}</p>
              <p className="truncate text-xs text-slate-500">{a.note}</p>
            </div>
            <Button variant="ghost" size="sm">Review</Button>
          </li>
        ))}
      </ul>
      </CardContent>
    </Card>
  );
}
