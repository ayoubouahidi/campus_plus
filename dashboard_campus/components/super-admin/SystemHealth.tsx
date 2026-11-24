import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function SystemHealth() {
  return (
    <Card>
      <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
      <CardContent>
      <p className="text-sm text-slate-500">The backend does not currently expose a system health endpoint.</p>
      </CardContent>
    </Card>
  );
}
