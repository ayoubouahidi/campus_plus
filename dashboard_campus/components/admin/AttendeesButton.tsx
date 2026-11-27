"use client";

import { useCallback, useId, useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/dashboard-api";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import FormAlert from "@/components/shared/FormAlert";

type Attendee = { id: number; full_name: string; avatar_url: string | null };
type AttendeePage = { count: number; next: string | null; results: Attendee[] };

const PAGE_SIZE = 100;

// "Who's going" for one event: opens a dialog with the students who RSVPed (name + photo),
// newest first, 100 at a time with "Show more".
export default function AttendeesButton({ eventId, eventName, count }: { eventId: number; eventName: string; count: number }) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [total, setTotal] = useState(count);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError("");
      try {
        const data = await dashboardApi<AttendeePage>(
          `api/club-events/${eventId}/attendees/?page=${nextPage}&page_size=${PAGE_SIZE}`
        );
        setAttendees((current) => (nextPage === 1 ? data.results : [...current, ...data.results]));
        setTotal(data.count);
        setPage(nextPage);
        setHasMore(Boolean(data.next));
      } catch (requestError) {
        setError(errorMessage(requestError, "Unable to load who's going."));
      } finally {
        setLoading(false);
      }
    },
    [eventId]
  );

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={count === 0}
        onClick={() => {
          setOpen(true);
          void load(1);
        }}
        aria-label={`See who's going to ${eventName}`}
      >
        {count === 0 ? "No one yet" : "See who's going"}
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <ModalHeader onClose={() => setOpen(false)}>
          <ModalTitle id={titleId}>Who&rsquo;s going</ModalTitle>
          <ModalDescription className="pt-1 text-sm">
            {eventName} · {total} {total === 1 ? "student" : "students"}
          </ModalDescription>
        </ModalHeader>
        <FormAlert message={error} />
        {loading && attendees.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400" aria-live="polite">Loading…</p>
        ) : attendees.length === 0 && !error ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No one has RSVPed yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {attendees.map((attendee) => (
              <li key={attendee.id} className="flex items-center gap-3 py-2.5">
                <Avatar src={attendee.avatar_url} name={attendee.full_name} size="sm" />
                <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{attendee.full_name}</span>
              </li>
            ))}
          </ul>
        )}
        <ModalFooter>
          {hasMore && (
            <Button type="button" variant="secondary" isLoading={loading} onClick={() => void load(page + 1)}>
              Show more
            </Button>
          )}
          <Button type="button" onClick={() => setOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
