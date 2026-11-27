import { Card, CardContent } from "@/components/ui/Card";

// One number with its label and a short note (e.g. "4 active"), for page summaries.
export default function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{value}</p>
        {note && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>}
      </CardContent>
    </Card>
  );
}
