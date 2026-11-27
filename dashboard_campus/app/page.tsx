import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Entry point: each role goes to its own area.
export default async function Home() {
  const session = await auth();
  if (!session?.backendToken) redirect("/login");
  if (session.user.role === "SUPERADMIN") redirect("/super_admin");
  if (session.user.role === "BOARD_MEMBER") redirect("/admin");
  redirect("/login?error=AccessDenied");
}
