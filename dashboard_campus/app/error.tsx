"use client";

import { Button } from "@/components/ui/Button";

// Shown when a page can't load its data (e.g. the backend is down).
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">This page couldn&rsquo;t load</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The server didn&rsquo;t answer as expected. Try again in a moment.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
