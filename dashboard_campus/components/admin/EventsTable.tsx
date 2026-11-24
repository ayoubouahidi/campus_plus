import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { StatusVariant } from "@/components/ui/Badge";
import Link from "next/link";

type EventStatus = "Planned" | "Ongoing" | "Completed" | "Cancelled";
const statusVariants: Record<EventStatus, StatusVariant> = {
  Planned: "warning",
  Ongoing: "success",
  Completed: "neutral",
  Cancelled: "danger",
};

type ClubEvent = {
  id: number;
  name: string;
  starts_at: string | null;
  status: string;
};

export default function EventsTable({ events }: { events: ClubEvent[] }) {
  const rows = events.slice(0, 5).map((event) => ({
          id: event.id,
          name: event.name,
          date: event.starts_at
            ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.starts_at))
            : "Date not set",
          status: ({
            planned: "Planned",
            ongoing: "Ongoing",
            completed: "Completed",
            cancelled: "Cancelled",
          }[event.status] ?? "Planned") as EventStatus,
        }));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Upcoming &amp; Recent Events</CardTitle>
        <Link href="/admin/events" className="text-sm font-medium text-violet-600 hover:underline">View all</Link>
      </CardHeader>

      <CardContent className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500">
            <th className="rounded-l-lg px-3 py-2.5 font-medium">Event</th>
            <th className="px-3 py-2.5 font-medium">Date</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-3.5 font-semibold text-slate-900">{e.name}</td>
              <td className="px-3 py-3.5 text-slate-600">{e.date}</td>
              <td className="px-3 py-3.5">
                <Badge variant={statusVariants[e.status]} hasDot>
                  {e.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-5 text-center text-sm text-slate-500">No club events to display.</p>}
      </CardContent>
    </Card>
  );
}
