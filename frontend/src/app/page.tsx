import { EventCardBench } from '@/app/_bench/EventCardBench';
import { mockEvents } from '@/lib/mockData';
import { getEventSchedules } from '@/lib/time';

// Server Component: event times are formatted here, with the server's time-zone data, and passed down
// as plain strings, so the browser renders exactly the same text (no hydration mismatch).
export default function Home() {
  return <EventCardBench schedules={getEventSchedules(mockEvents)} />;
}
