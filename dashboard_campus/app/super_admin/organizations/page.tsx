import Topbar from "@/components/admin/Topbar";
import SuperAdminResourceManager from "@/components/super-admin/SuperAdminResourceManager";

export const instant = false;

export default function OrganizationsPage() {
  return (
    <>
      <Topbar title="Organizations" subtitle="Manage campus organizations and their status" />
      <SuperAdminResourceManager
        endpoint="api/superadmin/organizations/"
        title="Organizations"
        description="Create, update, activate, suspend, or remove organizations."
        fields={[
          { name: "name", label: "Organization name", required: true },
          { name: "department_name", label: "Department" },
          { name: "is_active", label: "Status", type: "checkbox", defaultChecked: true },
        ]}
        columns={[
          { key: "name", label: "Organization" },
          { key: "department_name", label: "Department" },
          { key: "is_active", label: "Status", format: "status" },
        ]}
      />
    </>
  );
}
