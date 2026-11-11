'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/Tabs';
import {
  CALENDAR_STEPS,
  CALENDAR_TITLES,
  isCalendarView,
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
}

// The interactive part of /calendar: owns the selected day and the view, composes header, grids and agenda.
// One piece of date state (selectedKey): the month/week shown and the agenda all follow it.
export const EventCalendar = ({ events, eventIdsByDay, eventTimes, todayKey }: EventCalendarProps) => {
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [view, setView] = useState<CalendarView>('month');

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
      <Tabs value={view} onValueChange={(next) => isCalendarView(next) && setView(next)}>
        <CalendarHeader
          title={CALENDAR_TITLES[view](selectedKey)}
          view={view}
          onPrevious={() => setSelectedKey((key) => CALENDAR_STEPS[view](key, -1))}
          onNext={() => setSelectedKey((key) => CALENDAR_STEPS[view](key, 1))}
          onToday={() => setSelectedKey(todayKey)}
        />

        {/* tabIndex -1: each grid has its own Tab stop (the selected day), the panels don't need one. */}
        <TabsContent value="month" tabIndex={-1}>
          <MonthGrid
            selectedKey={selectedKey}
            todayKey={todayKey}
            eventsByDay={eventsByDay}
            onSelectDay={setSelectedKey}
          />
        </TabsContent>
        <TabsContent value="week" tabIndex={-1}>
          <WeekGrid
            selectedKey={selectedKey}
            todayKey={todayKey}
            eventsByDay={eventsByDay}
            eventTimes={eventTimes}
            onSelectDay={setSelectedKey}
          />
        </TabsContent>
      </Tabs>

      <DayAgenda
        dayKey={selectedKey}
        events={eventsByDay[selectedKey] ?? []}
        eventTimes={eventTimes}
        className="lg:sticky lg:top-20"
      />
    </div>
  );
};
