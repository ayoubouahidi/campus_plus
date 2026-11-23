import Topbar from "@/components/admin/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { backendFetch } from "@/lib/api";

export const instant = false;

type WeeklyRegistration = { date: string; registrations: number };
type ClubEvent = { id: number; name: string; capacity?: number | null };

export default async function RegistrationsPage() {
  let weeklyRegistrations: { day: string; value: number }[] = [];
  let eventRegistrations: { event: string; registered: number; capacity: number }[] = [];
  try {
    const [weeklyResponse, eventsResponse] = await Promise.all([
      backendFetch<WeeklyRegistration[]>("/api/board/registrations/weekly/"),
      backendFetch<ClubEvent[] | { results: ClubEvent[] }>("/api/club-events/"),
    ]);
    weeklyRegistrations = weeklyResponse.map((item) => ({
      day: new Intl.DateTimeFormat("en", { weekday: "short" }).format(
        new Date(`${item.date}T12:00:00`)
      ),
      value: item.registrations,
    }));
    const events = "results" in eventsResponse ? eventsResponse.results : eventsResponse;
    eventRegistrations = events.slice(0, 8).map((event) => ({
      event: event.name,
      registered: 0,
      capacity: event.capacity ?? 0,
    }));
  } catch {
    weeklyRegistrations = [];
    eventRegistrations = [];
  }

  return (
    <>
      <Topbar title="Registrations" subtitle="Event registrations for Robotics & AI Research Club" />

      <main className="p-6">
        {weeklyRegistrations.length > 0 && eventRegistrations.length > 0 ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Registrations over the last 7 days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-56 items-end justify-between gap-4 px-2">
                  {weeklyRegistrations.map((day) => (
                    <div
                      key={day.day}
                      className="flex h-full flex-1 flex-col items-center justify-end"
                    >
                      <span className="mb-2 text-xs font-medium text-slate-600">{day.value}</span>
                      <div
                        className="w-full max-w-12 rounded-t-md bg-violet-600"
                        style={{ height: `${day.value}%` }}
                      />
                      <span className="mt-2 text-xs text-slate-500">{day.day}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Registrations by event</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {eventRegistrations.map((registration) => (
                  <div key={registration.event}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{registration.event}</span>
                      <span className="text-slate-500">
                        {registration.registered} / {registration.capacity}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-violet-600"
                        style={{
                          width: `${
                            registration.capacity > 0
                              ? (registration.registered / registration.capacity) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="text-sm text-red-600">Registration data is not available.</p>
        )}
      </main>
    </>
  );
}
