import Sidebar from "@/components/admin/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ToastProvider>
  );
}
