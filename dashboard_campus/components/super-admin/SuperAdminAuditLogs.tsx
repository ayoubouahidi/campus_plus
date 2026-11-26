"use client";

import { useEffect, useState } from "react";
import { dashboardApi } from "@/lib/dashboard-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type AuditRow = {
  id: string | number;
  actor_username: string | null;
  action: string;
  target: string;
  created_at: string;
};
type AuditResponse = AuditRow[] | { results: AuditRow[] };

function extractRows(response: AuditResponse) {
  const rows = Array.isArray(response) ? response : response.results;
  if (!Array.isArray(rows)) throw new Error("The backend returned an invalid audit log response.");
  return rows;
}

export default function SuperAdminAuditLogs() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi<AuditResponse>("api/superadmin/audit-log/?page=1&page_size=100")
      .then((response) => setRows(extractRows(response)))
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Unable to load audit logs."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-500">A read-only record of administrative activity.</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <Card>
        <CardHeader><CardTitle>Recent activity <span className="ml-1 text-sm font-normal text-slate-500">({rows.length})</span></CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading audit logs…</p> : rows.length ? (
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-slate-50 text-xs text-slate-500">
                <th className="px-3 py-2.5 font-medium">Actor</th>
                <th className="px-3 py-2.5 font-medium">Action</th>
                <th className="px-3 py-2.5 font-medium">Target</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
              </tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3.5 font-medium text-slate-800">{row.actor_username || "System"}</td>
                <td className="px-3 py-3.5 text-slate-700">{row.action.replaceAll("_", " ")}</td>
                <td className="px-3 py-3.5 text-slate-600">{row.target || "—"}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-slate-500">{row.created_at ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at)) : "—"}</td>
              </tr>)}</tbody>
            </table>
          ) : <p className="py-8 text-center text-sm text-slate-500">No audit activity available.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
