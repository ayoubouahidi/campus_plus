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

export const members = [
  { name: "Salma Idrissi", role: "Club Admin", joined: "Jan 12, 2025", status: "Active" },
  { name: "Omar Benali", role: "Member", joined: "Feb 03, 2025", status: "Active" },
  { name: "Lina Amrani", role: "Event Coordinator", joined: "Mar 18, 2025", status: "Active" },
  { name: "Hamza Kettani", role: "Member", joined: "Apr 09, 2025", status: "Active" },
  { name: "Nora El Fassi", role: "Member", joined: "May 27, 2025", status: "Pending" },
];

export const announcements = [
  {
    title: "AI Buildathon registration is open",
    message: "Members can register for the AI Buildathon and Demo Day until November 18.",
    date: "Nov 10, 2025",
  },
  {
    title: "Weekly club meeting",
    message: "The next club meeting will take place in the innovation lab on Thursday at 17:00.",
    date: "Nov 08, 2025",
  },
  {
    title: "New workshop materials available",
    message: "The materials for the Robotics Assembly Workshop are now available to members.",
    date: "Nov 05, 2025",
  },
];

export const eventRegistrations = [
  { event: "AI Buildathon & Demo Day", registered: 128, capacity: 150 },
  { event: "Robotics Assembly Workshop", registered: 42, capacity: 60 },
  { event: "Intro to Quantum Computing", registered: 48, capacity: 80 },
  { event: "Robotics Sprint 2025", registered: 34, capacity: 50 },
];
