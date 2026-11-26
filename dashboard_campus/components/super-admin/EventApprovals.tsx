"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboardApi } from "@/lib/dashboard-api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type PendingEvent = {
  id: string | number;
  name?: string;
  title?: string;
  club_name?: string;
  organization_name?: string;
  starts_at?: string | null;
  start_time?: string | null;
  location?: string;
  status?: string;
};
type EventResponse = PendingEvent[] | { results: PendingEvent[] };

function extractEvents(response: EventResponse) {
  const events = Array.isArray(response) ? response : response.results;
  if (!Array.isArray(events)) throw new Error("The backend returned an invalid event list.");
  return events;
}

async function fetchEvents() {
  return extractEvents(await dashboardApi<EventResponse>("api/superadmin/events/?status=pending"));
}

export default function EventApprovals() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEvents(await fetchEvents());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load event approvals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents().then(setEvents).catch((requestError: unknown) => {
      setError(requestError instanceof Error ? requestError.message : "Unable to load event approvals.");
    }).finally(() => setLoading(false));
  }, []);

  async function decide(event: PendingEvent, decision: "approve" | "reject") {
    setBusyId(event.id);
    setError("");
    try {
      await dashboardApi(`api/superadmin/events/${event.id}/${decision}/`, { method: "POST" });
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Unable to ${decision} this event.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Event Approvals</h1>
        <p className="mt-1 text-sm text-slate-500">Review events waiting for platform approval.</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <Card>
        <CardHeader><CardTitle>Pending events <span className="ml-1 text-sm font-normal text-slate-500">({events.length})</span></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading pending events…</p> : events.length ? events.map((event) => {
            const name = event.name ?? event.title ?? `Event ${event.id}`;
            const starts = event.starts_at ?? event.start_time;
            return (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900">{name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {[event.club_name ?? event.organization_name, event.location, starts ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(starts)) : null].filter(Boolean).join(" · ") || "No additional event details"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busyId !== null} isLoading={busyId === event.id} onClick={() => void decide(event, "approve")}>Approve</Button>
                  <Button size="sm" variant="danger" disabled={busyId !== null} onClick={() => void decide(event, "reject")}>Reject</Button>
                </div>
              </div>
            );
          }) : <p className="py-8 text-center text-sm text-slate-500">There are no pending event approvals.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
