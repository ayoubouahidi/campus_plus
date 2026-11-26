import Topbar from "@/components/admin/Topbar";
import { backendFetch } from "@/lib/api";
import EventsManager, { type DashboardEvent } from "@/components/admin/EventsManager";

export const instant = false;

type BoardClub = {
  id: number;
  department_id: number;
  name: string;
};

export default async function MyEventsPage() {
  const club = await backendFetch<BoardClub>("/api/board/club/");
  const response = await backendFetch<DashboardEvent[] | { results: DashboardEvent[] }>("/api/club-events/");
  const allEvents = Array.isArray(response) ? response : response.results;
  const events = allEvents.filter((event) => event.club === club.id);

  return (
    <>
      <Topbar title="My Events" subtitle={`Events for ${club.name}`} />
      <main className="p-6">
        <EventsManager events={events} clubId={club.id} departmentId={club.department_id} />
      </main>
    </>
  );
}
