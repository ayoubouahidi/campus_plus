import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Page not found</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">This dashboard page doesn&rsquo;t exist.</p>
      <Link href="/" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
        Back to the dashboard
      </Link>
    </main>
  );
}
