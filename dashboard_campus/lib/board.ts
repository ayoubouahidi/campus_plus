import { backendFetch } from "@/lib/api";
import type { DashboardEvent, EventCategory } from "@/lib/events";

export type BoardClub = {
  id: number;
  slug: string;
  category: EventCategory | null;
  department_id: number;
  name: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  president: { id: number; name: string; email: string; phone: string } | null;
};

export type BoardTeamMember = { id: number; name: string; email: string; status: "active" | "inactive" };

export function getBoardClub() {
  return backendFetch<BoardClub>("/api/board/club/");
}

/** Every event of the board member's club (the API filters by club slug). */
export async function getClubEvents(club: Pick<BoardClub, "slug">) {
  const response = await backendFetch<{ results: DashboardEvent[] }>(
    `/api/club-events/?club=${encodeURIComponent(club.slug)}&page_size=200`
  );
  return response.results;
}
