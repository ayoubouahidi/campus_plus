import { weeklyEvents as mockWeeklyEvents } from "@/lib/super-admin-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function ActivityChart({
  weeklyEvents,
}: {
  weeklyEvents?: { week_start: string; events: number }[];
}) {
  const rows =
    weeklyEvents && weeklyEvents.length > 0
      ? weeklyEvents.map((item, index) => ({
          week: `W${index + 1}`,
          value: item.events,
        }))
      : mockWeeklyEvents;
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform activity — events created per week</CardTitle>
      </CardHeader>

      <CardContent>
      <div className="mt-6 flex h-44 items-end justify-between gap-6 px-2">
        {rows.map((d, i) => (
          <div key={d.week} className="flex h-full flex-1 flex-col items-center justify-end">
            <div
              className={`w-full max-w-[32px] rounded-md ${
                i === rows.length - 1 ? "bg-violet-600" : "bg-violet-300"
              }`}
              style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            />
            <span className="mt-2 text-[11px] text-slate-500">{d.week}</span>
          </div>
        ))}
      </div>
      </CardContent>
    </Card>
  );
}
