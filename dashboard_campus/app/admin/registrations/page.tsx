import { backendFetch } from "@/lib/api";
import { getBoardClub, getClubEvents } from "@/lib/board";
import { eventPhase } from "@/lib/events";
import { formatDateTime, formatShortDay } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import PageBody from "@/components/layout/PageBody";
import PageHeader from "@/components/layout/PageHeader";
import BarChart from "@/components/shared/BarChart";
import { tableStyles as t } from "@/components/shared/table";

export const metadata = { title: "Registrations" };

type WeeklyRegistration = { date: string; registrations: number };

async function loadRegistrations() {
  const club = await getBoardClub();
  const [events, weekly] = await Promise.all([
    getClubEvents(club),
    backendFetch<WeeklyRegistration[]>("/api/board/registrations/weekly/"),
  ]);
  return { events, weekly, now: Date.now() };
}

export default async function RegistrationsPage() {
  const { events, weekly, now } = await loadRegistrations();
  const upcoming = events
    .filter((event) => eventPhase(event, now) === "upcoming")
    .sort((a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime());

  return (
    <PageBody>
      <PageHeader title="Registrations" description="Who is going to your club's events (RSVPs from Campus Hub)." />

      <Card>
        <CardHeader>
          <CardTitle>New RSVPs, last 7 days</CardTitle>
          <CardDescription>Per day, for all your club&rsquo;s events.</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart
            caption="New RSVPs per day, last 7 days"
            valueLabel="RSVPs"
            data={weekly.map((row) => ({ label: formatShortDay(row.date), value: row.registrations }))}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Upcoming events</CardTitle>
          <CardDescription>Places taken per event.</CardDescription>
        </CardHeader>
        <div className={t.wrapper}>
          <table className={t.table}>
            <thead>
              <tr className={t.headRow}>
                <th scope="col" className={t.th}>Event</th>
                <th scope="col" className={t.th}>Starts</th>
                <th scope="col" className={t.th}>Going</th>
                <th scope="col" className={t.th}>Places left</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((event) => {
                const left = event.capacity ? Math.max(0, event.capacity - event.rsvps_count) : null;
                return (
                  <tr key={event.id} className={t.row}>
                    <td className={t.tdStrong}>{event.name}</td>
                    <td className={`${t.td} whitespace-nowrap`}>{formatDateTime(event.starts_at)}</td>
                    <td className={t.td}>{event.rsvps_count}</td>
                    <td className={t.td}>
                      {left === null ? (
                        "No limit"
                      ) : left === 0 ? (
                        <Badge variant="danger">Full</Badge>
                      ) : (
                        `${left} of ${event.capacity}`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {upcoming.length === 0 && <p className={t.empty}>No upcoming events.</p>}
        </div>
      </Card>
    </PageBody>
  );
}
