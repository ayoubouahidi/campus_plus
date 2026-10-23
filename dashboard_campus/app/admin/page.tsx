import Topbar from "@/components/admin/Topbar";
import StatCard from "@/components/admin/StatCard";
import EventsTable from "@/components/admin/EventsTable";
import RegistrationsChart from "@/components/admin/RegistrationsChart";
import PendingApprovals from "@/components/admin/PendingApprovals";
import QuickActions from "@/components/admin/QuickActions";
import { stats } from "@/lib/mock-data";

export default function OverviewPage() {
  return (
    <>
      <Topbar title="Club Overview" subtitle="Robotics & AI Research Club • 1337" />

      <main className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <EventsTable />
            <RegistrationsChart />
          </div>
          <div className="space-y-6">
            <PendingApprovals />
            <QuickActions />
          </div>
        </div>
      </main>
    </>
  );
}
