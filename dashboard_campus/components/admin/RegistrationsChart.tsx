import { weeklyRegistrations } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function RegistrationsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrations — last 7 days</CardTitle>
      </CardHeader>

      <CardContent>
      <div className="mt-6 flex h-44 items-end justify-between gap-6 px-2">
        {weeklyRegistrations.map((d) => (
          <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end">
            <div
              className="w-full max-w-[32px] rounded-md bg-violet-600"
              style={{ height: `${d.value}%` }}
            />
            <span className="mt-2 text-[11px] text-slate-500">{d.day}</span>
          </div>
        ))}
      </div>
      </CardContent>
    </Card>
  );
}
