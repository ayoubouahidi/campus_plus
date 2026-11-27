// Date formatting shared by the dashboard (English, like the rest of the dashboard UI).
const dateTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const shortDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

/** "Nov 24" for an ISO date (YYYY-MM-DD), read at noon so time zones can't shift the day. */
export function formatShortDay(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : shortDay.format(date);
}

/** Audit actions are snake_case ("organization_created"): show them as sentences. */
export function formatAction(action: string) {
  const text = action.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
