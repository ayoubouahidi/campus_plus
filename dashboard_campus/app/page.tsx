import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const instant = false;

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "SUPERADMIN") redirect("/super_admin");
  if (session.user.role === "BOARD_MEMBER") redirect("/admin");
  redirect("/login?error=AccessDenied");
}
