import PageBody from "@/components/layout/PageBody";
import OrganizationsManager from "@/components/super-admin/OrganizationsManager";

export const metadata = { title: "Organizations" };

export default function OrganizationsPage() {
  return (
    <PageBody>
      <OrganizationsManager />
    </PageBody>
  );
}
