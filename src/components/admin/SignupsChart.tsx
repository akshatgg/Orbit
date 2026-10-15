import { barHeights, type DailyPoint } from "@/lib/admin/kpi";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const label = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));

/** CSS-only bar chart of sign-ups per day, with an accessible table fallback. */
export function SignupsChart({ series }: { series: DailyPoint[] }) {
  const heights = barHeights(series.map((p) => p.count));
  const total = series.reduce((s, p) => s + p.count, 0);
  const max = Math.max(0, ...series.map((p) => p.count));

  return (
    <figure className="px-4 pb-4 pt-3">
      <figcaption className="mb-3 flex items-baseline justify-between text-xs text-muted">
        <span><span className="font-display text-lg font-semibold text-fg tabular-nums">{total}</span> in {series.length} days</span>
        <span className="tabular-nums">peak {max}/day</span>
      </figcaption>
      <div className="relative h-36" aria-hidden>
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-line/70" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line/40" />
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {series.map((p, i) => (
            <div key={p.day} className="group relative flex h-full flex-1 items-end">
              <div
                className={`w-full rounded-t-[3px] transition-all ${p.count > 0 ? "bg-gradient opacity-80 group-hover:opacity-100" : "bg-line/60"}`}
                style={{ height: p.count > 0 ? `${heights[i]}%` : "2px" }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-bg px-2 py-1 text-[11px] text-fg group-hover:block">
                {label(p.day)} · {p.count}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted" aria-hidden>
        <span>{series[0] && label(series[0].day)}</span>
        <span>{series.at(-1) && label(series.at(-1)!.day)}</span>
      </div>
      <table className="sr-only">
        <caption>Sign-ups per day</caption>
        <thead><tr><th>Day</th><th>Sign-ups</th></tr></thead>
        <tbody>{series.map((p) => <tr key={p.day}><td>{label(p.day)}</td><td>{p.count}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
