import Topbar from "@/components/admin/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { backendFetch } from "@/lib/api";

export const instant = false;

type Announcement = {
  id: number;
  title: string;
  message: string;
  created_at: string;
};

export default async function AnnouncementsPage() {
  const [response, club] = await Promise.all([
    backendFetch<Announcement[] | { results: Announcement[] }>("/api/board/announcements/"),
    backendFetch<{ name: string }>("/api/board/club/"),
  ]);
  const announcements = Array.isArray(response) ? response : response.results;
  const rows = announcements.map((announcement) => ({
    title: announcement.title,
    message: announcement.message,
    date: new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
      new Date(announcement.created_at)
    ),
  }));

  return (
    <>
      <Topbar title="Announcements" subtitle={`Announcements for ${club.name}`} />

      <main className="p-6">
        {rows.length > 0 ? (
          <div className="space-y-4">
            {rows.map((announcement) => (
              <Card key={announcement.title}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle>{announcement.title}</CardTitle>
                    <span className="shrink-0 text-xs text-slate-500">{announcement.date}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{announcement.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-red-600">Announcement data is not available.</p>
        )}
      </main>
    </>
  );
}
