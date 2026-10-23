import { weeklyEvents } from "@/lib/super-admin-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function ActivityChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform activity — events created per week</CardTitle>
      </CardHeader>

      <CardContent>
      <div className="mt-6 flex h-44 items-end justify-between gap-6 px-2">
        {weeklyEvents.map((d, i) => (
          <div key={d.week} className="flex h-full flex-1 flex-col items-center justify-end">
            <div
              className={`w-full max-w-[32px] rounded-md ${
                i === weeklyEvents.length - 1 ? "bg-violet-600" : "bg-violet-300"
              }`}
              style={{ height: `${d.value}%` }}
            />
            <span className="mt-2 text-[11px] text-slate-500">{d.week}</span>
          </div>
        ))}
      </div>
      </CardContent>
    </Card>
  );
}
