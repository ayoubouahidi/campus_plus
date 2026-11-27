// One table style for every dashboard list, so columns, padding and borders line up
// from page to page (light and dark).
export const tableStyles = {
  wrapper: "overflow-x-auto",
  table: "w-full min-w-[640px] text-left text-sm",
  headRow: "border-b border-slate-200/80 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400",
  th: "px-4 py-3 font-semibold",
  thRight: "px-4 py-3 text-right font-semibold",
  row: "border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-slate-800/70 dark:hover:bg-slate-800/40",
  td: "px-4 py-3.5 align-middle text-slate-700 dark:text-slate-300",
  tdStrong: "px-4 py-3.5 align-middle font-semibold text-slate-900 dark:text-slate-100",
  tdActions: "whitespace-nowrap px-4 py-3 text-right align-middle",
  empty: "px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400",
} as const;

export const searchInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20 sm:w-72 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";
