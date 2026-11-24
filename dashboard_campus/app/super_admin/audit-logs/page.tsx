import Topbar from "@/components/admin/Topbar";
import SuperAdminAuditLogs from "@/components/super-admin/SuperAdminAuditLogs";

export const instant = false;

export default function AuditLogsPage() {
  return (
    <>
      <Topbar title="Audit Logs" subtitle="Administrative activity history" />
      <SuperAdminAuditLogs />
    </>
  );
}
