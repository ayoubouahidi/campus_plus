import { Card, CardContent } from "@/components/ui/Card";

// CardContent is "p-5 pt-0" (it normally follows a CardHeader): alone in a card it needs pt-5.
// One number with its label and a short note (e.g. "4 active"), for page summaries.
export default function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{value}</p>
        {note && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>}
      </CardContent>
    </Card>
  );
}
