import Topbar from "@/components/admin/Topbar";
import RegistrationsChart from "@/components/admin/RegistrationsChart";
import { backendFetch } from "@/lib/api";

export const instant = false;

type WeeklyRegistration = { date: string; registrations: number };
type BoardStats = { registrations_this_month: number | null };

export default async function RegistrationsPage() {
  const [stats, club] = await Promise.all([
    backendFetch<BoardStats>("/api/board/stats/"),
    backendFetch<{ name: string }>("/api/board/club/"),
  ]);
  const weeklyResponse = stats.registrations_this_month === null
    ? null
    : await backendFetch<WeeklyRegistration[]>("/api/board/registrations/weekly/");
  return (
    <>
      <Topbar title="Registrations" subtitle={`Registrations for ${club.name}`} />

      <main className="max-w-3xl p-6">
        {weeklyResponse
          ? <RegistrationsChart registrations={weeklyResponse} />
          : <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Registration analytics are unavailable because the backend does not expose RSVP records yet.</p>}
      </main>
    </>
  );
}
