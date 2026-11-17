'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent } from '@/components/ui/Tabs';
import {
  CALENDAR_STEPS,
  CALENDAR_TITLES,
  calendarQuery,
  eventFromCalendarHref,
  isCalendarView,
  readCalendarLocation,
  type CalendarView,
  type DayKey,
  type EventTimes,
} from '@/lib/calendar';
import type { EventItem } from '@/types/api';
import { CalendarHeader } from './CalendarHeader';
import { DayAgenda } from './DayAgenda';
import { MonthGrid } from './MonthGrid';
import { WeekGrid } from './WeekGrid';

export interface EventCalendarProps {
  events: EventItem[];
  // Everything below is computed on the server (campus time zone, see lib/calendar.ts).
  eventIdsByDay: Record<DayKey, string[]>;
  eventTimes: Record<string, EventTimes>;
  todayKey: DayKey;
  // Keep the selected day and view in the query string (?date=…&view=week): reload, share and "back to
  // calendar" from an event page all land on the same place. Off for a calendar embedded in another page.
  urlState?: boolean;
}

// The interactive part of /calendar: owns the selected day and the view, composes header, grids and agenda.
// One piece of date state (selectedKey): the month/week shown and the agenda all follow it.
export const EventCalendar = ({ events, eventIdsByDay, eventTimes, todayKey, urlState = false }: EventCalendarProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL is read once, as the starting point; after that React state leads and the URL follows (show()).
  // useSearchParams (not server props) so Back/Forward, which restore the URL we wrote, start from it too.
  const [initial] = useState(() =>
    urlState ? readCalendarLocation((name) => searchParams.get(name)) : {}
  );
  const [selectedKey, setSelectedKey] = useState<DayKey>(initial.date ?? todayKey);
  const [view, setView] = useState<CalendarView>(initial.view ?? 'month');

  // Every change goes through here: state, then the address bar. replaceState, not pushState: clicking
  // through days shouldn't fill the Back button's history. Next.js syncs it with useSearchParams (no
  // server request). Today is left out of the URL so "today" stays relative when the link is shared.
  const show = (date: DayKey, nextView: CalendarView) => {
    setSelectedKey(date);
    setView(nextView);
    if (!urlState) return;
    const query = calendarQuery({ date: date === todayKey ? undefined : date, view: nextView });
    window.history.replaceState(null, '', `${pathname}${query}`);
  };

  // Ids → events, once per data change. One object per event, so a future RSVP update shows everywhere.
  const eventsByDay = useMemo(() => {
    const byId = new Map(events.map((event) => [event.id, event]));
    return Object.fromEntries(
      Object.entries(eventIdsByDay).map(([day, ids]) => [day, ids.flatMap((id) => byId.get(id) ?? [])])
    );
  }, [events, eventIdsByDay]);

  return (
    // Below lg: agenda under the grid. lg+: beside it, sticky under the navbar while the page scrolls.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <Tabs value={view} onValueChange={(next) => isCalendarView(next) && show(selectedKey, next)}>
        <CalendarHeader
          title={CALENDAR_TITLES[view](selectedKey)}
          view={view}
          onPrevious={() => show(CALENDAR_STEPS[view](selectedKey, -1), view)}
          onNext={() => show(CALENDAR_STEPS[view](selectedKey, 1), view)}
          onToday={() => show(todayKey, view)}
        />

        {/* tabIndex -1: each grid has its own Tab stop (the selected day), the panels don't need one. */}
        <TabsContent value="month" tabIndex={-1}>
          <MonthGrid
            selectedKey={selectedKey}
            todayKey={todayKey}
            eventsByDay={eventsByDay}
            onSelectDay={(key) => show(key, view)}
          />
        </TabsContent>
        <TabsContent value="week" tabIndex={-1}>
          <WeekGrid
            selectedKey={selectedKey}
            todayKey={todayKey}
            eventsByDay={eventsByDay}
            eventTimes={eventTimes}
            onSelectDay={(key) => show(key, view)}
          />
        </TabsContent>
      </Tabs>

      <DayAgenda
        dayKey={selectedKey}
        events={eventsByDay[selectedKey] ?? []}
        eventTimes={eventTimes}
        eventHref={urlState ? (event) => eventFromCalendarHref(event.id, { date: selectedKey, view }) : undefined}
        className="lg:sticky lg:top-20"
      />
    </div>
  );
};
