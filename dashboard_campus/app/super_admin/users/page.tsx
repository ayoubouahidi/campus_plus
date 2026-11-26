import Topbar from "@/components/admin/Topbar";
import SuperAdminResourceManager from "@/components/super-admin/SuperAdminResourceManager";

export const instant = false;

export default function UsersAndRolesPage() {
  return (
    <>
      <Topbar title="Users & Roles" subtitle="Manage platform accounts and access roles" />
      <SuperAdminResourceManager
        endpoint="api/superadmin/users/"
        title="Users"
        description="Create accounts, assign roles, update account details, or remove users."
        fields={[
          { name: "username", label: "Username", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "password", label: "Password", type: "password", required: true, createOnly: true },
          { name: "first_name", label: "First name" },
          { name: "last_name", label: "Last name" },
          {
            name: "role",
            label: "Role",
            type: "select",
            required: true,
            options: [
              { label: "Student", value: "STUDENT" },
              { label: "Board member", value: "BOARD_MEMBER" },
              { label: "Super admin", value: "SUPERADMIN" },
            ],
          },
          {
            name: "club_id",
            label: "Organization / club",
            type: "select",
            nullable: true,
            optionsEndpoint: "api/superadmin/organizations/?page_size=200",
            optionLabelKey: "name",
          },
          { name: "is_active", label: "Active account", type: "checkbox", defaultChecked: true },
        ]}
        columns={[
          { key: "username", label: "Username" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role", format: "role" },
          { key: "club_name", label: "Organization" },
          { key: "is_active", label: "Account status", format: "status" },
        ]}
      />
    </>
  );
}
