import Topbar from "@/components/admin/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { announcements } from "@/lib/mock-data";

export default function AnnouncementsPage() {
  return (
    <>
      <Topbar title="Announcements" subtitle="Announcements for Robotics & AI Research Club" />

      <main className="p-6">
        {announcements.length > 0 ? (
          <div className="space-y-4">
            {announcements.map((announcement) => (
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
