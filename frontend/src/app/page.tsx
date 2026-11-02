import { FeedBench } from '@/app/_bench/FeedBench';
import { mockEvents } from '@/lib/mockData';
import { getEventSchedules } from '@/lib/time';

// Server Component: event times are formatted here, with the server's time-zone data, and passed down
// as plain strings, so the browser renders exactly the same text (no hydration mismatch, DOCS.md §5.2).
export default function Home() {
  return <FeedBench schedules={getEventSchedules(mockEvents)} />;
}
