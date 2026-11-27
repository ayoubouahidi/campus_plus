// Simple vertical bar chart (no chart library). The bars are decorative; a
// visually hidden table gives screen readers the same numbers.
export type BarDatum = { label: string; value: number };

export default function BarChart({
  data,
  caption,
  valueLabel,
}: {
  data: BarDatum[];
  caption: string;
  valueLabel: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <figure>
      <div aria-hidden="true" className="flex h-52 items-end gap-2 sm:gap-4">
        {data.map((item, index) => (
          <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.value}</span>
            <div
              className={`w-full max-w-10 rounded-t-md ${index === data.length - 1 ? "bg-violet-600 dark:bg-violet-500" : "bg-violet-300 dark:bg-violet-500/40"}`}
              style={{ height: `${Math.max(3, (item.value / max) * 85)}%` }}
            />
            <span className="w-full truncate text-center text-[11px] text-slate-500 dark:text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
      {/* The wrapper is what hides it: a <caption> renders outside the table box, so
          sr-only on the <table> alone left the caption visible under the chart. */}
      <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{item.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
