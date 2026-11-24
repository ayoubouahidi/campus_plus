import Sidebar from "@/components/admin/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { backendFetch } from "@/lib/api";

type DashboardIdentity = {
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await backendFetch<DashboardIdentity>("/api/me/");
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ToastProvider>
  );
}
