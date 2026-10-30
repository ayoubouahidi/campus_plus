import React from 'react';
import Link from 'next/link';
import { EventCategory, EventItem } from '@/types/api';
import { Card, CardBanner, CardTitle, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CheckIcon, MapPinIcon, NAV_ICONS } from '@/components/ui/layout/navIcons';
import { CATEGORY_LABELS } from '@/lib/events';
import { formatEventSchedule } from '@/lib/time';

export interface EventCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  event: EventItem;
  onRsvpToggle: (event: EventItem) => void;
}

// Grid breakpoints (1 → 2 → 3 columns, capped by max-w-7xl), so phones never download a desktop-sized flyer.
const FLYER_SIZES = '(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

// No-flyer fallback: category tint + icon, so the grid keeps its rhythm and the category still reads at a glance.
const fallbackStyles: Record<EventCategory, string> = {
  Tech: 'bg-lime-100 text-lime-600 dark:bg-lime-500/10 dark:text-lime-400',
  Media: 'bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  Music: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
  Sports: 'bg-teal-100 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
  Business: 'bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
  Gaming: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-400',
  EventsOrganization: 'bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
};

const CalendarIcon = NAV_ICONS.calendar;

export const EventCard = React.forwardRef<HTMLDivElement, EventCardProps>(
  ({ event, onRsvpToggle, className = '', ...props }, ref) => {
    const { day, time } = formatEventSchedule(event.start_time);
    const isGoing = event.has_user_rsvpd;

    return (
      <Card ref={ref} isHoverable className={`relative flex h-full flex-col ${className}`} {...props}>
        <CardBanner
          src={event.flyer_url}
          sizes={FLYER_SIZES}
          fallback={
            <div className={`flex h-full w-full items-center justify-center ${fallbackStyles[event.category]}`}>
              <CalendarIcon className="h-10 w-10" />
            </div>
          }
        />

        <div className="flex-1 space-y-2 p-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant={event.category}>{CATEGORY_LABELS[event.category]}</Badge>
            <time dateTime={event.start_time} className="text-xs font-semibold text-violet-600 dark:text-violet-400">
              {day} · {time}
            </time>
          </div>

          <CardTitle className="line-clamp-2">
            {/* Stretched link: its ::after covers the whole card, so the card is clickable without nesting
                the RSVP button inside a link. The ring is drawn on the ::after, i.e. around the card. */}
            <Link
              href={`/events/${event.id}`}
              className="text-lg after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-violet-500"
            >
              {event.title}
            </Link>
          </CardTitle>

          <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <MapPinIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {event.location} · {event.department_name}
            </span>
          </p>
        </div>

        <CardFooter className="gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {event.attendees_preview.length > 0 && (
              // Hidden from screen readers (the count says it); raised above the link so name tooltips work.
              <AvatarGroup max={3} aria-hidden="true" className="relative z-10 shrink-0">
                {event.attendees_preview.map((attendee) => (
                  <Avatar
                    key={attendee.id}
                    size="xs"
                    name={attendee.full_name}
                    src={attendee.avatar_url}
                    title={attendee.full_name}
                  />
                ))}
              </AvatarGroup>
            )}
            <span className="truncate text-sm text-slate-500 dark:text-slate-400">
              {event.rsvps_count === 0 ? 'No RSVPs yet' : `${event.rsvps_count} going`}
            </span>
          </div>

          <Button
            size="sm"
            variant={isGoing ? 'secondary' : 'primary'}
            leftIcon={isGoing ? <CheckIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : undefined}
            onClick={() => onRsvpToggle(event)}
            className="relative z-10 shrink-0"
          >
            {isGoing ? 'Going' : 'RSVP'}
            {/* Six "RSVP" buttons are indistinguishable in a screen reader's button list without the title. */}
            <span className="sr-only">{isGoing ? ` to ${event.title}, cancel RSVP` : ` to ${event.title}`}</span>
          </Button>
        </CardFooter>
      </Card>
    );
  }
);

EventCard.displayName = 'EventCard';
