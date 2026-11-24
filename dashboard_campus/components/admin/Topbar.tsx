import { Avatar } from "@/components/ui/Avatar";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { backendFetch } from "@/lib/api";

type DashboardIdentity = {
  full_name: string;
  avatar_url: string | null;
};

export default async function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const profile = await backendFetch<DashboardIdentity>("/api/me/");
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
      </div>
    </header>
  );
}
