import SuperSidebar from "@/components/super-admin/SuperSidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { backendFetch } from "@/lib/api";

type DashboardIdentity = {
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await backendFetch<DashboardIdentity>("/api/me/");
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-50">
        <SuperSidebar profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ToastProvider>
  );
}
