import Topbar from "@/components/admin/Topbar";
import EventApprovals from "@/components/super-admin/EventApprovals";

export const instant = false;

export default function EventApprovalsPage() {
  return (
    <>
      <Topbar title="Event Approvals" subtitle="Review and decide on pending events" />
      <EventApprovals />
    </>
  );
}
