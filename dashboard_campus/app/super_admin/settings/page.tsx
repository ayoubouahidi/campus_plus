import Topbar from "@/components/admin/Topbar";
import SuperAdminResourceManager from "@/components/super-admin/SuperAdminResourceManager";

export const instant = false;

export default function SystemSettingsPage() {
  return (
    <>
      <Topbar title="System Settings" subtitle="Manage platform-wide configuration" />
      <SuperAdminResourceManager
        endpoint="api/superadmin/settings/"
        title="Settings"
        description="Maintain system configuration values. Changes are saved through the backend settings API."
        fields={[
          { name: "key", label: "Setting key", required: true, createOnly: true },
          { name: "value", label: "Value", type: "textarea", required: true },
          { name: "description", label: "Description", type: "textarea" },
          { name: "is_active", label: "Status", type: "checkbox", defaultChecked: true },
        ]}
        columns={[
          { key: "key", label: "Key" },
          { key: "value", label: "Value" },
          { key: "description", label: "Description" },
          { key: "is_active", label: "Status", format: "status" },
        ]}
      />
    </>
  );
}
