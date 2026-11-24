import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function RegistrationsChart({
  registrations,
}: {
  registrations: { date: string; registrations: number }[];
}) {
  const rows = registrations.map((item) => ({
          day: new Intl.DateTimeFormat("en", { weekday: "short" }).format(
            new Date(`${item.date}T12:00:00`)
          ),
          value: item.registrations,
        }));
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrations — last 7 days</CardTitle>
      </CardHeader>

      <CardContent>
      {rows.length === 0 ? <p className="text-sm text-slate-500">No registration data available.</p> : (
      <div className="mt-6 flex h-44 items-end justify-between gap-6 px-2">
        {rows.map((d) => (
          <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end">
            <div
              className="w-full max-w-[32px] rounded-md bg-violet-600"
              style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            />
            <span className="mt-2 text-[11px] text-slate-500">{d.day}</span>
          </div>
        ))}
      </div>
      )}
      </CardContent>
    </Card>
  );
}
