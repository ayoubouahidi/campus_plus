import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";

export default function Topbar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Input
          aria-label="Search dashboard"
          className="w-64 rounded-full border-0 bg-slate-100 py-2"
          placeholder="Search..."
          leftIcon={<span className="h-2.5 w-2.5 rounded-full bg-slate-400" />}
        />
        <Avatar name="Salma Idrissi" size="sm" status="online" />
      </div>
    </header>
  );
}
