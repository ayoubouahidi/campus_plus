// Sidebar entries for each dashboard area. Only screens backed by a real API
// are listed (no settings, approvals or announcements screens: the platform has
// no such features, see DOCS).

export type NavIcon =
  | "overview"
  | "organizations"
  | "users"
  | "analytics"
  | "audit"
  | "events"
  | "registrations"
  | "members"
  | "settings";

export type NavItem = { label: string; href: string; icon: NavIcon };

export type DashboardArea = "super_admin" | "admin";

export const NAVIGATION: Record<DashboardArea, { badge: string; items: NavItem[] }> = {
  super_admin: {
    badge: "Super admin",
    items: [
      { label: "Overview", href: "/super_admin", icon: "overview" },
      { label: "Organizations", href: "/super_admin/organizations", icon: "organizations" },
      { label: "Users & roles", href: "/super_admin/users", icon: "users" },
      { label: "Analytics", href: "/super_admin/analytics", icon: "analytics" },
      { label: "Audit log", href: "/super_admin/audit-logs", icon: "audit" },
    ],
  },
  admin: {
    badge: "Club board",
    items: [
      { label: "Overview", href: "/admin", icon: "overview" },
      { label: "Events", href: "/admin/events", icon: "events" },
      { label: "Registrations", href: "/admin/registrations", icon: "registrations" },
      { label: "Board team", href: "/admin/members", icon: "members" },
      { label: "Club settings", href: "/admin/settings", icon: "settings" },
    ],
  },
};
