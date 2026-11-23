import Topbar from "@/components/admin/Topbar";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { backendFetch } from "@/lib/api";
import type { EventStatus } from "@/lib/mock-data";

export const instant = false;

const statusVariants: Record<EventStatus, "success" | "warning" | "danger"> = {
  Confirmed: "success",
  Pending: "warning",
  Cancelled: "danger",
};

type ClubEvent = {
  id: number;
  name: string;
  starts_at: string | null;
  status: string;
};

export default async function MyEventsPage() {
  let events: ClubEvent[] = [];
  try {
    const response = await backendFetch<ClubEvent[] | { results: ClubEvent[] }>("/api/club-events/");
    events = "results" in response ? response.results : response;
  } catch {
    events = [];
  }
  const rows = events.map((event) => ({
    name: event.name,
    date: event.starts_at
      ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.starts_at))
      : "Date not set",
    registered: "—",
    status:
      event.status === "cancelled"
        ? ("Cancelled" as const)
        : event.status === "completed"
          ? ("Confirmed" as const)
          : event.status === "ongoing"
            ? ("Confirmed" as const)
            : ("Pending" as const),
  }));

  return (
    <>
      <Topbar title="My Events" subtitle="Events created by Robotics & AI Research Club" />

      <main className="p-6">
        {rows.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Club events</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500">
                    <th className="rounded-l-lg px-3 py-2.5 font-medium">Event</th>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Registered</th>
                    <th className="rounded-r-lg px-3 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((event) => (
                    <tr key={event.name} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3.5 font-semibold text-slate-900">
                        {event.name}
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">{event.date}</td>
                      <td className="px-3 py-3.5 text-slate-600">{event.registered}</td>
                      <td className="px-3 py-3.5">
                        <Badge variant={statusVariants[event.status]} hasDot>
                          {event.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-red-600">No event data is available.</p>
        )}
      </main>
    </>
  );
}
