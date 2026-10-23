import { Card, CardContent } from "@/components/ui/Card";

export default function StatCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      <p className={`mt-2 text-xs ${
        tone === "good"
          ? "text-emerald-600"
          : tone === "warn"
            ? "text-amber-500"
            : "text-slate-500"
      }`}>
        {note}
      </p>
      </CardContent>
    </Card>
  );
}
