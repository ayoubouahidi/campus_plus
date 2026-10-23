import Topbar from "@/components/admin/Topbar";
import StatCard from "@/components/admin/StatCard";
import OrganizationsTable from "@/components/super-admin/OrganizationsTable";
import RoleAssignments from "@/components/super-admin/RoleAssignments";
import ActivityChart from "@/components/super-admin/ActivityChart";
import RoleDistribution from "@/components/super-admin/RoleDistribution";
import SystemHealth from "@/components/super-admin/SystemHealth";
import AuditLog from "@/components/super-admin/AuditLog";
import { platformStats } from "@/lib/super-admin-data";

export default function SuperAdminOverviewPage() {
  return (
    <>
      <Topbar
        title="Platform Overview"
        subtitle="All tenants • UM6P Ben Guerir Campus"
      />

      <main className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {platformStats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <OrganizationsTable />
            <RoleAssignments />
            <ActivityChart />
          </div>
          <div className="space-y-6">
            <RoleDistribution />
            <SystemHealth />
            <AuditLog />
          </div>
        </div>
      </main>
    </>
  );
}
