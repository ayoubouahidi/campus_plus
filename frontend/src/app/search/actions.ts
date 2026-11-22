'use server';

import { forSignedOutVisitor } from '@/lib/events';
import { listClubs, listEvents } from '@/lib/data';
import type { Club, EventItem } from '@/types/api';

// What the ⌘K palette searches (Step 14.4, DOCS.md §14.4): every event and club, loaded once when the palette
// opens; useCampusSearch ranks them in the browser as it always did. Server action, so Django's internal
// address stays on the server.
//
// Sent as a signed-out visitor would see them, whoever asks: search results show no attendee names, no
// "you're going" and no contact details, so none of that is put in the browser's search data (the mocks
// carry president emails and attendee names; Django already leaves them out of anonymous answers).
export async function loadSearchData(): Promise<{ events: EventItem[]; clubs: Club[] }> {
  const [events, clubs] = await Promise.all([listEvents(), listClubs()]);
  return {
    events: events.map(forSignedOutVisitor),
    clubs: clubs.map((club) => {
      const copy = { ...club };
      delete copy.president_email;
      delete copy.president_phone;
      return copy;
    }),
  };
}
