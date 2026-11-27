import { getBoardClub, getClubEvents } from "@/lib/board";
import PageBody from "@/components/layout/PageBody";
import EventsManager from "@/components/admin/EventsManager";

export const metadata = { title: "Events" };

async function loadEvents() {
  const club = await getBoardClub();
  const events = await getClubEvents(club);
  // Request time, taken with the data (not during render).
  return { club, events, now: Date.now() };
}

export default async function EventsPage() {
  const { club, events, now } = await loadEvents();
  return (
    <PageBody>
      <EventsManager events={events} clubId={club.id} departmentId={club.department_id} clubName={club.name} now={now} />
    </PageBody>
  );
}
