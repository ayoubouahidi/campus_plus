"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { dashboardApi, errorMessage, fieldErrorsOf, type FieldErrors } from "@/lib/dashboard-api";
import { formatDateTime } from "@/lib/format";
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  eventPhase,
  type DashboardEvent,
  type EventPhase,
} from "@/lib/events";
import { Badge, type StatusVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import FormAlert from "@/components/shared/FormAlert";
import { tableStyles as t } from "@/components/shared/table";
import ImagePicker, { imageFileError } from "@/components/shared/ImagePicker";
import PageHeader from "@/components/layout/PageHeader";

type Props = {
  events: DashboardEvent[];
  clubId: number;
  departmentId: number;
  clubName: string;
  /** Request time from the server, so "upcoming" and "ended" match the student site. */
  now: number;
};

type Filter = "upcoming" | "ended" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "ended", label: "Past & cancelled" },
  { value: "all", label: "All" },
];

const PHASE_BADGE: Record<EventPhase, { label: string; variant: StatusVariant }> = {
  upcoming: { label: "Upcoming", variant: "success" },
  ended: { label: "Ended", variant: "neutral" },
  cancelled: { label: "Cancelled", variant: "danger" },
};


/** ISO date → value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function EventsManager({ events, clubId, departmentId, clubName, now }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const formTitleId = useId();

  const [filter, setFilter] = useState<Filter>("upcoming");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DashboardEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [deleting, setDeleting] = useState<DashboardEvent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const visible = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime()
    );
    if (filter === "all") return sorted;
    if (filter === "upcoming") return sorted.filter((event) => eventPhase(event, now) === "upcoming");
    return sorted.filter((event) => eventPhase(event, now) !== "upcoming").reverse();
  }, [events, filter, now]);

  function openForm(event: DashboardEvent | null) {
    setEditing(event);
    setFormError("");
    setFieldErrors({});
    setFormOpen(true);
  }

  function clearFieldError(name: string) {
    if (fieldErrors[name]) setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const startsAt = value("starts_at");
    const endsAt = value("ends_at");
    const capacity = value("capacity");
    const image = form.get("image_path");

    const errors: FieldErrors = {};
    if (!value("name")) errors.name = "Give the event a name.";
    if (!value("category")) errors.category = "Choose a category.";
    if (!startsAt) errors.starts_at = "Choose when the event starts.";
    if (!endsAt) errors.ends_at = "Choose when the event ends.";
    else if (startsAt && new Date(endsAt) <= new Date(startsAt)) errors.ends_at = "The end must be after the start.";
    if (!value("location")) errors.location = "Say where the event takes place.";
    if (capacity && (!/^\d+$/.test(capacity) || Number(capacity) < 1)) errors.capacity = "Enter a whole number of places (1 or more), or leave it empty.";
    const imageProblem = imageFileError(image);
    if (imageProblem) errors.image_path = imageProblem;
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length) return;

    const payload = new FormData();
    payload.append("name", value("name"));
    payload.append("description", value("description"));
    payload.append("category", value("category"));
    payload.append("location", value("location"));
    payload.append("status", value("status") || "planned");
    payload.append("capacity", capacity);
    payload.append("club", String(clubId));
    payload.append("parent_id", String(departmentId));
    payload.append("starts_at", new Date(startsAt).toISOString());
    payload.append("ends_at", new Date(endsAt).toISOString());
    if (image instanceof File && image.size > 0) payload.append("image_path", image);

    setSaving(true);
    try {
      await dashboardApi(editing ? `api/club-events/${editing.id}/` : "api/club-events/", {
        method: editing ? "PATCH" : "POST",
        body: payload,
      });
      setFormOpen(false);
      showToast({
        variant: "success",
        title: editing ? "Event updated" : "Event published",
        description: editing ? value("name") : `${value("name")} is now on Campus Hub.`,
      });
      router.refresh();
    } catch (error) {
      const errorsFromServer = fieldErrorsOf(error);
      setFieldErrors(errorsFromServer);
      setFormError(Object.keys(errorsFromServer).length ? "" : errorMessage(error, "Unable to save the event."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await dashboardApi(`api/club-events/${deleting.id}/`, { method: "DELETE" });
      showToast({ variant: "success", title: "Event deleted", description: deleting.name });
      setDeleting(null);
      router.refresh();
    } catch (error) {
      setDeleteError(errorMessage(error, "Unable to delete the event."));
    } finally {
      setDeleteBusy(false);
    }
  }

  const statusOptions = [
    { value: "planned", label: "Scheduled" },
    { value: "cancelled", label: "Cancelled" },
    ...(editing && (editing.status === "ongoing" || editing.status === "completed")
      ? [{ value: editing.status, label: editing.status === "ongoing" ? "Ongoing" : "Completed" }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Events"
        description={`Events of ${clubName}. Students see changes live on Campus Hub.`}
        actions={<Button onClick={() => openForm(null)}>New event</Button>}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 p-4 dark:border-slate-800" role="group" aria-label="Show events">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                filter === option.value
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className={t.wrapper}>
          <table className={t.table}>
            <thead>
              <tr className={t.headRow}>
                <th scope="col" className={t.th}>Event</th>
                <th scope="col" className={t.th}>Starts</th>
                <th scope="col" className={t.th}>Going</th>
                <th scope="col" className={t.th}>Status</th>
                <th scope="col" className={t.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((event) => {
                const phase = PHASE_BADGE[eventPhase(event, now)];
                return (
                  <tr key={event.id} className={t.row}>
                    <td className={t.td}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                          {event.flyer_url && (
                            // eslint-disable-next-line @next/next/no-img-element -- thumbnail of a media URL
                            <img src={event.flyer_url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{event.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {categoryLabel(event.category)} · {event.location || "No location"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`${t.td} whitespace-nowrap`}>{formatDateTime(event.starts_at)}</td>
                    <td className={`${t.td} whitespace-nowrap`}>
                      {event.rsvps_count}
                      {event.capacity ? ` / ${event.capacity}` : ""}
                    </td>
                    <td className={t.td}>
                      <Badge variant={phase.variant} hasDot>
                        {phase.label}
                      </Badge>
                    </td>
                    <td className={t.tdActions}>
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openForm(event)} aria-label={`Edit ${event.name}`}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setDeleteError("");
                            setDeleting(event);
                          }}
                          aria-label={`Delete ${event.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className={t.empty}>
              {events.length === 0
                ? "No events yet. Publish your club's first event."
                : filter === "upcoming"
                  ? "No upcoming events."
                  : "No past or cancelled events."}
            </p>
          )}
        </div>
      </Card>

      <Modal isOpen={formOpen} onClose={() => !saving && setFormOpen(false)} size="xl" labelledBy={formTitleId}>
        <form key={editing?.id ?? "new"} onSubmit={submit} noValidate>
          <ModalHeader onClose={() => !saving && setFormOpen(false)}>
            <ModalTitle id={formTitleId}>{editing ? "Edit event" : "New event"}</ModalTitle>
            <ModalDescription className="pt-1">Fields marked * are required. Times are in your time zone.</ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <FormAlert message={formError} />
            <Input name="name" label="Name *" maxLength={255} defaultValue={editing?.name ?? ""} error={fieldErrors.name} onChange={() => clearFieldError("name")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                name="category"
                label="Category *"
                defaultValue={editing?.category ?? ""}
                placeholder="Choose a category"
                options={CATEGORY_OPTIONS}
                error={fieldErrors.category}
                onChange={() => clearFieldError("category")}
              />
              <Input name="location" label="Location *" maxLength={255} placeholder="e.g. 1337 Benguerir, Cluster 2" defaultValue={editing?.location ?? ""} error={fieldErrors.location} onChange={() => clearFieldError("location")} />
              <Input name="starts_at" type="datetime-local" label="Starts *" defaultValue={toLocalInput(editing?.starts_at ?? null)} error={fieldErrors.starts_at} onChange={() => clearFieldError("starts_at")} />
              <Input name="ends_at" type="datetime-local" label="Ends *" defaultValue={toLocalInput(editing?.ends_at ?? null)} error={fieldErrors.ends_at} onChange={() => clearFieldError("ends_at")} />
              <Input
                name="capacity"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                label="Places"
                helperText={fieldErrors.capacity ? undefined : "Leave empty for no limit."}
                defaultValue={editing?.capacity ?? ""}
                error={fieldErrors.capacity}
                onChange={() => clearFieldError("capacity")}
              />
              <Select
                name="status"
                label="Status"
                defaultValue={editing?.status ?? "planned"}
                options={statusOptions}
                helperText="Cancelled events stay visible to students, marked as cancelled."
                error={fieldErrors.status}
              />
            </div>
            <Textarea name="description" label="Description" rows={4} defaultValue={editing?.description ?? ""} error={fieldErrors.description} />
            <ImagePicker
              name="image_path"
              label="Flyer"
              aspect="flyer"
              currentUrl={editing?.flyer_url}
              helperText={editing?.flyer_url ? "JPEG, PNG or WebP under 2 MB. Leave empty to keep the current flyer." : "JPEG, PNG or WebP under 2 MB."}
              error={fieldErrors.image_path}
              onChange={() => clearFieldError("image_path")}
            />
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {editing ? "Save changes" : "Publish event"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleting !== null}
        title="Delete this event?"
        description={`“${deleting?.name ?? ""}” will disappear from Campus Hub and its ${deleting?.rsvps_count ?? 0} RSVPs will be removed. Students who RSVPed are notified. To keep it visible, set its status to Cancelled instead.`}
        busy={deleteBusy}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
