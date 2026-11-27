import DashboardShell, { type ShellProfile } from "@/components/layout/DashboardShell";
import { ToastProvider } from "@/components/ui/Toast";
import { backendFetch } from "@/lib/api";

export const metadata = { title: { default: "Club board", template: "%s · Campus Hub Dashboard" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [profile, club] = await Promise.all([
    backendFetch<ShellProfile>("/api/me/"),
    backendFetch<{ name: string }>("/api/board/club/"),
  ]);
  return (
    <ToastProvider>
      <DashboardShell area="admin" profile={profile} context={club.name}>
        {children}
      </DashboardShell>
    </ToastProvider>
  );
}
