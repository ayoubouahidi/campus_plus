"use server";

import { auth, signOut } from "@/auth";

/**
 * Log out: revoke the Django token first (so it can't be reused), then clear the
 * Auth.js session cookie and go back to the login page.
 */
export async function logout() {
  const session = await auth();
  const backendUrl = process.env.BACKEND_URL;
  if (session?.backendToken && backendUrl) {
    try {
      await fetch(`${backendUrl.replace(/\/$/, "")}/api/auth/logout/`, {
        method: "POST",
        headers: { Authorization: `Token ${session.backendToken}` },
        cache: "no-store",
      });
    } catch {
      // The backend is down: still end the dashboard session.
    }
  }
  await signOut({ redirectTo: "/login" });
}
