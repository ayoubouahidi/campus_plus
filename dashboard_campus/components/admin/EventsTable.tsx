import { events, type EventStatus } from "@/lib/mock-data";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const statusVariants: Record<EventStatus, "success" | "warning" | "danger"> = {
  Confirmed: "success",
  Pending: "warning",
  Cancelled: "danger",
};

export default function EventsTable() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Upcoming &amp; Recent Events</CardTitle>
        <Button variant="ghost" size="sm">View all</Button>
      </CardHeader>

      <CardContent className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500">
            <th className="rounded-l-lg px-3 py-2.5 font-medium">Event</th>
            <th className="px-3 py-2.5 font-medium">Date</th>
            <th className="px-3 py-2.5 font-medium">Registered</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="rounded-r-lg px-3 py-2.5 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.name} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-3.5 font-semibold text-slate-900">{e.name}</td>
              <td className="px-3 py-3.5 text-slate-600">{e.date}</td>
              <td className="px-3 py-3.5 text-slate-600">{e.registered}</td>
              <td className="px-3 py-3.5">
                <Badge variant={statusVariants[e.status]} hasDot>
                  {e.status}
                </Badge>
              </td>
              <td className="px-3 py-3.5 text-slate-700">
                <Button variant="ghost" size="sm">
                  {e.status === "Cancelled" ? "View" : "Edit"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </CardContent>
    </Card>
  );
}
