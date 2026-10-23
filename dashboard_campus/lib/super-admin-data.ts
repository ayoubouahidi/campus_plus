export type Tenant = "1337" | "EMINES" | "UM6P";
export type OrgStatus = "Active" | "Pending" | "Suspended";

export const tenantStyles: Record<Tenant, string> = {
  "1337": "bg-blue-100 text-blue-600",
  EMINES: "bg-fuchsia-100 text-fuchsia-600",
  UM6P: "bg-violet-100 text-violet-600",
};

export const platformStats = [
  { label: "Total Users", value: "12,480", note: "+4.2% this month", tone: "good" },
  { label: "Organizations", value: "38", note: "1337 · EMINES · UM6P", tone: "neutral" },
  { label: "Events This Month", value: "214", note: "+18% vs last month", tone: "good" },
  { label: "Pending Approvals", value: "17", note: "5 older than 48h", tone: "warn" },
] as const;

export const organizations: {
  name: string;
  tenant: Tenant;
  admins: number;
  events: number;
  status: OrgStatus;
}[] = [
  { name: "1337 Coding School", tenant: "1337", admins: 6, events: 74, status: "Active" },
  { name: "EMINES Student Board", tenant: "EMINES", admins: 4, events: 58, status: "Active" },
  { name: "UM6P Robotics Club", tenant: "UM6P", admins: 3, events: 31, status: "Active" },
  { name: "UM6P Debate Union", tenant: "UM6P", admins: 2, events: 12, status: "Pending" },
  { name: "1337 Game Dev Guild", tenant: "1337", admins: 2, events: 19, status: "Suspended" },
];

export type Role = "Club Admin" | "Admin" | "Student";

export const roleStyles: Record<Role, string> = {
  "Club Admin": "bg-blue-100 text-blue-600",
  Admin: "bg-violet-100 text-violet-600",
  Student: "bg-slate-100 text-slate-600",
};

export const roleAssignments: {
  name: string;
  initials: string;
  color: string;
  role: Role;
  tenant: Tenant;
  assigned: string;
}[] = [
  { name: "Yassine El Amrani", initials: "YE", color: "bg-blue-500", role: "Club Admin", tenant: "1337", assigned: "2 min ago" },
  { name: "Imane Berrada", initials: "IB", color: "bg-fuchsia-500", role: "Club Admin", tenant: "EMINES", assigned: "1 hr ago" },
  { name: "Karim Tazi", initials: "KT", color: "bg-teal-500", role: "Admin", tenant: "UM6P", assigned: "Yesterday" },
  { name: "Sara Lahlou", initials: "SL", color: "bg-orange-500", role: "Student", tenant: "UM6P", assigned: "Yesterday" },
];

// width = how full the bar looks (0-100), not the real ratio
export const roleDistribution = [
  { label: "Students", count: "11,920", width: 100, color: "bg-violet-600" },
  { label: "Club Admins", count: "412", width: 30, color: "bg-blue-600" },
  { label: "Admins", count: "128", width: 12, color: "bg-fuchsia-500" },
  { label: "Super Admins", count: "5", width: 3, color: "bg-rose-500" },
];

export const systemHealth = [
  { name: "Daphne (WebSocket)", status: "Operational" },
  { name: "PostgreSQL 16", status: "Operational" },
  { name: "Nginx Proxy", status: "Operational" },
  { name: "Redis Cache", status: "Degraded" },
];

export const auditLog = [
  { initials: "RC", color: "bg-violet-600", title: "Role changed", detail: "YE → Club Admin • 2 min ago" },
  { initials: "OS", color: "bg-rose-500", title: "Org suspended", detail: "1337 Game Dev Guild • 1 hr ago" },
  { initials: "EA", color: "bg-emerald-500", title: "Event approved", detail: "AI Buildathon • 3 hrs ago" },
  { initials: "42", color: "bg-slate-800", title: "New 42 Intra login", detail: "s.lahlou • 5 hrs ago" },
];

export const weeklyEvents = [
  { week: "W1", value: 50 },
  { week: "W2", value: 68 },
  { week: "W3", value: 57 },
  { week: "W4", value: 85 },
  { week: "W5", value: 75 },
  { week: "W6", value: 65 },
  { week: "W7", value: 100 },
];
