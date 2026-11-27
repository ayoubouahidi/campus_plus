import DashboardShell, { type ShellProfile } from "@/components/layout/DashboardShell";
import { ToastProvider } from "@/components/ui/Toast";
import { backendFetch } from "@/lib/api";

export const metadata = { title: { default: "Super admin", template: "%s · Campus Hub Dashboard" } };

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await backendFetch<ShellProfile>("/api/me/");
  return (
    <ToastProvider>
      <DashboardShell area="super_admin" profile={profile} context="1337 · all organizations">
        {children}
      </DashboardShell>
    </ToastProvider>
  );
}
