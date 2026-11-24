'use client';

import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@/components/ui/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useToast, type ToastVariant } from '@/components/ui/Toast';
import { NotificationPanel, NotificationPopover, NotificationTrigger } from '@/components/ui/layout/NotificationPopover';
import { EventCard } from '@/components/events/EventCard';
import { toggleRsvp } from '@/lib/events';
import type { EventItem } from '@/types/api';
import type { EventSchedule } from '@/lib/time';
import type { AppNotification } from '@/types/notification';

// The specimens that need state (Step 17.1, DOCS.md §17): they behave exactly as on the real pages, with local
// sample data instead of Django, so nothing here changes real RSVPs or notifications.

export const FilterChipSpecimen = () => {
  const [selected, setSelected] = useState<'all' | 'tech' | 'music'>('tech');
  const chips: { value: typeof selected; label: string; dot?: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'tech', label: 'Tech', dot: 'bg-lime-500' },
    { value: 'music', label: 'Music', dot: 'bg-indigo-500' },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
      {chips.map((chip) => (
        <FilterChip
          key={chip.value}
          isSelected={selected === chip.value}
          dotClassName={chip.dot}
          onClick={() => setSelected(chip.value)}
        >
          {chip.label}
        </FilterChip>
      ))}
    </div>
  );
};

export const TabsSpecimen = () => (
  <div className="grid gap-6 sm:grid-cols-2">
    {(['segmented', 'underline'] as const).map((variant) => (
      <Tabs key={variant} defaultValue="month">
        <TabsList variant={variant} aria-label={`Calendar view (${variant})`}>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
        </TabsList>
        {['month', 'week', 'day'].map((value) => (
          <TabsContent key={value} value={value} className="pt-3 text-sm text-slate-600 dark:text-slate-400">
            {variant} tabs, “{value}” panel. Arrow keys move between tabs.
          </TabsContent>
        ))}
      </Tabs>
    ))}
  </div>
);

const TOASTS: Record<ToastVariant, { title: string; description: string }> = {
  success: { title: 'You’re going', description: 'Edge AI Hackathon was added to your profile.' },
  info: { title: 'Event updated', description: 'The place changed to Agora Hall.' },
  warning: { title: 'Few places left', description: 'Only 3 places remain for this workshop.' },
  danger: { title: 'Couldn’t save your RSVP', description: 'Try again in a moment.' },
};

export const ToastSpecimen = () => {
  const { showToast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(TOASTS) as ToastVariant[]).map((variant) => (
        <Button key={variant} variant="secondary" size="sm" onClick={() => showToast({ ...TOASTS[variant], variant })}>
          Show {variant}
        </Button>
      ))}
    </div>
  );
};

export const ModalSpecimen = () => {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open dialog</Button>
      <Modal isOpen={isOpen} onClose={close} size="md">
        <ModalHeader onClose={close}>
          <ModalTitle>Cancel your RSVP?</ModalTitle>
          <ModalDescription>Your place goes back to other students.</ModalDescription>
        </ModalHeader>
        <ModalContent>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Focus is trapped inside, Escape and the backdrop close it, and focus returns to the button.
          </p>
        </ModalContent>
        <ModalFooter>
          <Button variant="secondary" onClick={close}>
            Keep my place
          </Button>
          <Button variant="danger" onClick={close}>
            Cancel RSVP
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export const EventCardSpecimen = ({ event, schedule }: { event: EventItem; schedule: EventSchedule }) => {
  const [current, setCurrent] = useState(event);
  return (
    <div className="max-w-sm">
      <EventCard event={current} schedule={schedule} onRsvpToggle={(item) => setCurrent(toggleRsvp(item))} headingLevel="h3" />
    </div>
  );
};

export const NotificationSpecimen = ({ notifications }: { notifications: AppNotification[] }) => {
  const [items, setItems] = useState(notifications);
  const markRead = useCallback(
    (id: string) => setItems((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item))),
    []
  );
  const markAllRead = useCallback(() => setItems((current) => current.map((item) => ({ ...item, is_read: true }))), []);
  return (
    // The bell sits at the end of the row, as in the navbar: its panel opens towards the start side, so it stays
    // on screen (on the left of the bell in English, on the right in Arabic).
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-slate-600 dark:text-slate-400">Open the bell: sample notifications, read state kept locally.</span>
      <Button variant="ghost" size="sm" onClick={() => setItems(notifications)}>
        Reset
      </Button>
      <NotificationPopover notifications={items} onMarkRead={markRead} onMarkAllRead={markAllRead} className="ms-auto">
        <NotificationTrigger />
        <NotificationPanel />
      </NotificationPopover>
    </div>
  );
};
