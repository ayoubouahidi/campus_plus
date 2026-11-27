// Club events as the dashboard uses them (fields of GET /api/club-events/).

export type EventStatus = "planned" | "ongoing" | "completed" | "cancelled";

export type EventCategory = "Tech" | "Media" | "Music" | "Sports" | "Business" | "EventsOrganization" | "Gaming";

export type DashboardEvent = {
  id: number;
  name: string;
  description: string;
  club: number | null;
  parent_id: number;
  category: EventCategory | null;
  capacity: number | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string;
  status: EventStatus;
  flyer_url: string | null;
  rsvps_count: number;
};

/** Same categories, labels and order as the student site's filter chips. */
export const CATEGORY_OPTIONS: { value: EventCategory; label: string }[] = [
  { value: "Tech", label: "Tech" },
  { value: "Media", label: "Media" },
  { value: "Music", label: "Music" },
  { value: "Sports", label: "Sports" },
  { value: "Business", label: "Business" },
  { value: "EventsOrganization", label: "Events organization" },
  { value: "Gaming", label: "Gaming" },
];

export function categoryLabel(category: EventCategory | null) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? "No category";
}

/** What students see: cancelled, ended (past its end time) or upcoming/live. */
export type EventPhase = "cancelled" | "ended" | "upcoming";

export function eventPhase(event: Pick<DashboardEvent, "status" | "ends_at">, now: number): EventPhase {
  if (event.status === "cancelled") return "cancelled";
  if (event.ends_at && new Date(event.ends_at).getTime() <= now) return "ended";
  return "upcoming";
}
