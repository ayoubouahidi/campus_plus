import SuperSidebar from "@/components/super-admin/SuperSidebar";
import { ToastProvider } from "@/components/ui/Toast";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-50">
        <SuperSidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ToastProvider>
  );
}
