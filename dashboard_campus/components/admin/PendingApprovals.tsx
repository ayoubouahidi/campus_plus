"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardApi } from "@/lib/dashboard-api";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function PendingApprovals({
  requests,
}: {
  requests: { id: number; member_name: string; kind: string; note: string; status: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const pending = requests.filter((request) => request.status === "pending").slice(0, 5);

  async function decide(id: number, decision: "approve" | "reject") {
    setError("");
    try {
      await dashboardApi(`api/board/requests/${id}/${decision}/`, { method: "POST" });
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update the request.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Pending Approvals</CardTitle>
        <span className="text-xs text-slate-500">{pending.length} pending</span>
      </CardHeader>

      <CardContent>
      {error && <p role="alert" className="mb-3 text-xs text-rose-700">{error}</p>}
      {pending.length ? <ul className="space-y-4">
        {pending.map((request) => (
          <li key={request.id} className="flex items-center gap-3">
            <Avatar name={request.member_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{request.member_name}</p>
              <p className="truncate text-xs text-slate-500">{request.note || `${request.kind} request`}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void decide(request.id, "approve")}>Approve</Button>
            <Button variant="danger" size="sm" onClick={() => void decide(request.id, "reject")}>Reject</Button>
          </li>
        ))}
      </ul> : <p className="text-sm text-slate-500">No pending requests.</p>}
      </CardContent>
    </Card>
  );
}
