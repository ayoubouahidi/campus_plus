import { auth } from "@/auth";
import PageBody from "@/components/layout/PageBody";
import UsersManager from "@/components/super-admin/UsersManager";

export const metadata = { title: "Users & roles" };

export default async function UsersAndRolesPage() {
  const session = await auth();
  return (
    <PageBody>
      <UsersManager currentUserId={session?.user.id ?? ""} />
    </PageBody>
  );
}
