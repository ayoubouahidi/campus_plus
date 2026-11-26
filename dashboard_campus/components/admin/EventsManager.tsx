"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { dashboardApi } from "@/lib/dashboard-api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export type DashboardEvent = {
  id: number;
  name: string;
  description: string;
  club: number | null;
  parent_id: number;
  starts_at: string | null;
  ends_at: string | null;
  location: string;
  status: "planned" | "ongoing" | "completed" | "cancelled";
  image_path: string;
};

type Props = {
  events: DashboardEvent[];
  clubId: number;
  departmentId: number;
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

export default function EventsManager({ events, clubId, departmentId }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DashboardEvent | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function startCreate() {
    setEditing(null);
    setError("");
    setFormOpen(true);
  }

  function startEdit(event: DashboardEvent) {
    setEditing(event);
    setError("");
    setFormOpen(true);
  }

  async function submitEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError("");
    setBusy(true);
    const formData = new FormData(formEvent.currentTarget);
    const startsAt = String(formData.get("starts_at") ?? "");
    const endsAt = String(formData.get("ends_at") ?? "");
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("The end time must be after the start time.");
      setBusy(false);
      return;
    }
    const selectedImage = formData.get("image_path");
    if (selectedImage instanceof File && selectedImage.size > 0) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(selectedImage.type)) {
        setError("Choose a JPEG, PNG, or WebP event image.");
        setBusy(false);
        return;
      }
      if (selectedImage.size >= 2 * 1024 * 1024) {
        setError("The event image must be smaller than 2 MB.");
        setBusy(false);
        return;
      }
    }

    const payload = new FormData();
    for (const field of ["name", "description", "location", "status"]) {
      payload.append(field, String(formData.get(field) ?? ""));
    }
    payload.append("club", String(clubId));
    payload.append("parent_id", String(departmentId));
    payload.append("starts_at", new Date(startsAt).toISOString());
    payload.append("ends_at", new Date(endsAt).toISOString());
    if (selectedImage instanceof File && selectedImage.size > 0) payload.append("image_path", selectedImage);

    try {
      await dashboardApi(
        editing ? `api/club-events/${editing.id}/` : "api/club-events/",
        { method: editing ? "PATCH" : "POST", body: payload }
      );
      setFormOpen(false);
      setEditing(null);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save the event.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(event: DashboardEvent) {
    if (!window.confirm(`Delete “${event.name}”? This cannot be undone.`)) return;
    setError("");
    setBusy(true);
    try {
      await dashboardApi(`api/club-events/${event.id}/`, { method: "DELETE" });
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete the event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Club events</h2>
          <p className="text-sm text-slate-500">Changes are saved to the shared events API.</p>
        </div>
        <Button onClick={startCreate}>Create event</Button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit event" : "Create event"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form key={editing?.id ?? "new-event"} onSubmit={submitEvent} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                Event name
                <input name="name" required maxLength={255} defaultValue={editing?.name} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                Description
                <textarea name="description" rows={3} defaultValue={editing?.description} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Starts at
                <input name="starts_at" type="datetime-local" required defaultValue={toLocalDateTime(editing?.starts_at ?? null)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Ends at
                <input name="ends_at" type="datetime-local" required defaultValue={toLocalDateTime(editing?.ends_at ?? null)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Location
                <input name="location" required maxLength={255} defaultValue={editing?.location} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Status
                <select name="status" defaultValue={editing?.status ?? "planned"} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="planned">Planned</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                Event image (JPEG, PNG or WebP; under 2 MB)
                <input name="image_path" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" />
              </label>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" isLoading={busy}>{editing ? "Save changes" : "Create event"}</Button>
                <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {events.length ? (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{event.name}</h3>
                  <p className="text-sm text-slate-500">
                    {event.starts_at ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.starts_at)) : "No start date"}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(event)}>Edit</Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => void deleteEvent(event)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No events yet. Create your first club event.</p>
      )}
    </div>
  );
}
