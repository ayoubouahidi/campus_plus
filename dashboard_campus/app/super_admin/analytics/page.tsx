import Topbar from "@/components/admin/Topbar";
import SuperAdminAnalytics from "@/components/super-admin/SuperAdminAnalytics";

export const instant = false;

export default function AnalyticsPage() {
  return (
    <>
      <Topbar title="Analytics" subtitle="Platform-wide usage and activity" />
      <SuperAdminAnalytics />
    </>
  );
}
