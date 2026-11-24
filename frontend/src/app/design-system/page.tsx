import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { DesignSystemShowcase } from '@/components/design-system/DesignSystemShowcase';
import { getUpcomingEventCounts } from '@/lib/clubs';
import { mockClubs, mockEvents, mockNotifications } from '@/lib/mockData';
import { getRequestTime } from '@/lib/requestTime';
import { getEventSchedules } from '@/lib/time';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Meta');
  return { title: t('designSystem'), description: t('designSystemDescription') };
}

// `/design-system` (Step 17.2, DOCS.md §17): Campus Hub's design system by Atomic Design level, with the real
// components. Public, linked from the footer ("Project"). The organisms are fed sample data (mocks), never Django,
// so trying RSVP or "mark as read" here changes nothing real, in development and in production alike.
export default async function DesignSystemPage() {
  const locale = await getLocale();
  const now = await getRequestTime();
  const event = mockEvents.find((item) => item.flyer_url && item.attendees_preview.length > 0) ?? mockEvents[0];
  const club = mockClubs[0];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <DesignSystemShowcase
        event={event}
        schedule={getEventSchedules([event], locale)[event.id]}
        club={club}
        upcomingCount={getUpcomingEventCounts(mockEvents, now)[club.id] ?? 0}
        notifications={mockNotifications}
      />
    </div>
  );
}
