import type { EventCategory } from '@/types/api';

// No-flyer fallback: category tint + icon, so layouts keep their rhythm and the category still reads at a
// glance. Shared by EventCard and EventDetails.
export const flyerFallbackStyles: Record<EventCategory, string> = {
  Tech: 'bg-lime-100 text-lime-600 dark:bg-lime-500/10 dark:text-lime-400',
  Media: 'bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  Music: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
  Sports: 'bg-teal-100 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
  Business: 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
  Gaming: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-400',
  EventsOrganization: 'bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
};
