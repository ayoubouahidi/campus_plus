export const stats = [
  { label: "Total Events", value: "24", note: "+3 this month", tone: "good" },
  { label: "Registrations", value: "1,284", note: "+12.4% vs last month", tone: "good" },
  { label: "Active Members", value: "86", note: "+5 new members", tone: "good" },
  { label: "Pending Approvals", value: "7", note: "2 need review today", tone: "warn" },
] as const;

export type EventStatus = "Confirmed" | "Pending" | "Cancelled";

export const events: {
  name: string;
  date: string;
  registered: string;
  status: EventStatus;
}[] = [
  { name: "AI Buildathon & Demo Day", date: "Nov 20, 2025", registered: "128 / 150", status: "Confirmed" },
  { name: "Robotics Assembly Workshop", date: "Nov 24, 2025", registered: "42 / 60", status: "Pending" },
  { name: "Intro to Quantum Computing", date: "Nov 28, 2025", registered: "48 / 80", status: "Confirmed" },
  { name: "Hardware Hack Night", date: "Dec 02, 2025", registered: "0 / 40", status: "Cancelled" },
  { name: "Robotics Sprint 2025", date: "Dec 04, 2025", registered: "34 / 50", status: "Confirmed" },
];

export const approvals = [
  { name: "Omar Benali", initials: "OB", note: "Wants to join the club", color: "bg-blue-500" },
  { name: "Lina Amrani", initials: "LA", note: "Event co-host request", color: "bg-fuchsia-500" },
  { name: "Hamza Kettani", initials: "HK", note: "Wants to join the club", color: "bg-teal-500" },
  { name: "Nora El Fassi", initials: "NF", note: "Room booking request", color: "bg-orange-500" },
];

export const weeklyRegistrations = [
  { day: "Mon", value: 44 },
  { day: "Tue", value: 62 },
  { day: "Wed", value: 36 },
  { day: "Thu", value: 82 },
  { day: "Fri", value: 69 },
  { day: "Sat", value: 50 },
  { day: "Sun", value: 100 },
];
