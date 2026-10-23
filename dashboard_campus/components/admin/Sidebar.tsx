"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Overview", href: "/admin" },
  { label: "My Events", href: "/admin/events" },
  { label: "Registrations", href: "/admin/registrations" },
  { label: "Members", href: "/admin/members" },
  { label: "Announcements", href: "/admin/announcements" },
  { label: "Club Settings", href: "/admin/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-5">
      <h1 className="text-xl font-bold text-violet-600">CampusPulse</h1>
      <span className="mt-2 w-fit rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-600">
        CLUB ADMIN
      </span>

      <p className="mt-8 text-[11px] font-medium text-slate-400">MENU</p>
      <nav className="mt-3 space-y-1">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                active
                  ? "bg-slate-100 font-medium text-violet-600"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span
                className={`h-3.5 w-3.5 rounded ${
                  active ? "bg-violet-600" : "bg-slate-300"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-xl bg-slate-50 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
          SI
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Salma Idrissi</p>
          <p className="text-xs text-slate-500">Club Admin</p>
        </div>
      </div>
    </aside>
  );
}
