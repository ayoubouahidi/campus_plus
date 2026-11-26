"use client";

import { useEffect, useState } from "react";
import { dashboardApi } from "@/lib/dashboard-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type Stats = {
  total_users: number;
  total_clubs: number;
  events_this_month: number;
  pending_requests: number;
};
type WeeklyEvent = { week_start: string; events: number };
type RoleRow = { role: string; count: number };
type LoadState = { stats: Stats; weekly: WeeklyEvent[]; roles: RoleRow[] };

function arrayResponse<T>(response: T[] | { results: T[] }) {
  return Array.isArray(response) ? response : response.results;
}

export default function SuperAdminAnalytics() {
  const [data, setData] = useState<LoadState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      dashboardApi<Stats>("api/superadmin/stats/"),
      dashboardApi<WeeklyEvent[]>("api/superadmin/events/weekly/"),
      dashboardApi<RoleRow[] | { results: RoleRow[] }>("api/superadmin/roles/distribution/"),
    ]).then(([stats, weekly, roles]) => {
      if (active) setData({ stats, weekly, roles: arrayResponse(roles) });
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load analytics.");
    });
    return () => { active = false; };
  }, []);

  const stats = data ? [
    { label: "Total users", value: data.stats.total_users },
    { label: "Organizations", value: data.stats.total_clubs },
    { label: "Events this month", value: data.stats.events_this_month },
    { label: "Pending requests", value: data.stats.pending_requests },
  ] : [];
  const maxEvents = Math.max(1, ...(data?.weekly.map((item) => item.events) ?? []));
  const maxRoleCount = Math.max(1, ...(data?.roles.map((item) => item.count) ?? []));

  return (
    <main className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Platform Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Platform activity and account distribution from the backend.</p>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!data && !error && <p className="py-8 text-center text-sm text-slate-500">Loading analytics…</p>}
      {data && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => <Card key={item.label}><CardContent className="p-5">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value.toLocaleString()}</p>
          </CardContent></Card>)}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Events created per week</CardTitle></CardHeader>
            <CardContent>
              {data.weekly.length ? <div className="flex h-56 items-end justify-around gap-3">
                {data.weekly.map((item) => <div key={item.week_start} className="flex h-full flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-xs text-slate-500">{item.events}</span>
                  <div className="w-full max-w-12 rounded-t-md bg-violet-500" style={{ height: `${Math.max(4, item.events / maxEvents * 75)}%` }} />
                  <span className="mt-2 text-center text-xs text-slate-500">{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${item.week_start}T12:00:00`))}</span>
                </div>)}
              </div> : <p className="py-8 text-center text-sm text-slate-500">No event activity data available.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>User role distribution</CardTitle></CardHeader>
            <CardContent>
              {data.roles.length ? <ul className="space-y-4">
                {data.roles.map((item) => <li key={item.role} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{item.role.replaceAll("_", " ")}</span><span className="font-semibold text-slate-900">{item.count.toLocaleString()}</span></div>
                  <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-violet-500" style={{ width: `${item.count / maxRoleCount * 100}%` }} /></div>
                </li>)}
              </ul> : <p className="py-8 text-center text-sm text-slate-500">No role distribution data available.</p>}
            </CardContent>
          </Card>
        </div>
      </>}
    </main>
  );
}
