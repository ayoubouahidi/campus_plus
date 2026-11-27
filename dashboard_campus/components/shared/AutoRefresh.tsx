"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps server-rendered numbers fresh (RSVP counts, new events) without a reload:
// re-fetches the page's server data every `seconds` while the tab is visible, and at
// once when the tab comes back. router.refresh() keeps client state (open dialogs,
// filters, form input), so it never interrupts the user.
export default function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router, seconds]);

  return null;
}
