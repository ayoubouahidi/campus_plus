import { auth } from "@/auth";
import { redirect } from "next/navigation";

/** Call your backend from server components / server actions with the user's token. */
export async function backendFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await auth();
  if (!session?.backendToken) redirect("/login");

  const res = await fetch(`${process.env.BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      Authorization: `Token ${session.backendToken}`,
    },
    cache: "no-store",
  });

  if (res.status === 401) redirect("/login"); // token expired
  if (!res.ok) throw new Error(`Backend error ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}