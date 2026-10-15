import Link from "next/link";
import { WEEKDAYS } from "@/lib/taxonomy";
import { formatDayKey, formatMonth, monthGrid, shiftMonth } from "@/lib/discovery/dates";
import { ICONS } from "./Layout";

export type DayMarks = { registered: number; saved: number };

const href = (month: string, day?: string) => `/calendar?month=${month}${day ? `&day=${day}` : ""}`;

function NavArrow({ to, label, path }: { to: string; label: string; path: string }) {
  return (
    <Link
      href={to}
      scroll={false}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-2 text-muted transition-colors hover:text-fg"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </Link>
  );
}

/** Month grid with markers for days that have saved / registered events. Every day is a link. */
export function CalendarMonth({ month, today, selected, marks }: {
  month: string;
  today: string;
  selected: string | null;
  marks: ReadonlyMap<string, DayMarks>;
}) {
  const weeks = monthGrid(month);
  return (
    <div className="rounded-3xl border border-line bg-surface p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <NavArrow to={href(shiftMonth(month, -1))} label="Previous month" path={ICONS.chevronLeft} />
        <h2 className="font-display text-base font-semibold tracking-wide" aria-live="polite">{formatMonth(month)}</h2>
        <NavArrow to={href(shiftMonth(month, 1))} label="Next month" path={ICONS.chevronRight} />
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1" aria-label={formatMonth(month)}>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d.value} scope="col" className="pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
                <abbr title={d.label} className="no-underline">{d.label.slice(0, 1)}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].key}>
              {week.map((d) => {
                const m = marks.get(d.key);
                const isSelected = d.key === selected;
                const isToday = d.key === today;
                const total = (m?.registered ?? 0) + (m?.saved ?? 0);
                const label = `${formatDayKey(d.key)}${total ? `, ${total} event${total === 1 ? "" : "s"}` : ""}${isToday ? ", today" : ""}`;
                return (
                  <td key={d.key} className="p-0">
                    <Link
                      href={href(d.key.slice(0, 7), d.key)}
                      scroll={false}
                      aria-label={label}
                      aria-current={isSelected ? "date" : undefined}
                      className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                        isSelected
                          ? "bg-gradient font-semibold text-bg"
                          : isToday
                            ? "border border-violet/60 font-semibold text-fg"
                            : d.inMonth
                              ? "text-fg hover:bg-surface-2"
                              : "text-muted/40 hover:bg-surface-2"
                      }`}
                    >
                      {d.day}
                      {m && (
                        <span className="absolute bottom-1.5 flex gap-0.5" aria-hidden>
                          {m.registered > 0 && (
                            <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-bg" : "bg-gradient"}`} />
                          )}
                          {m.saved > 0 && (
                            <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-bg/60" : "bg-pink/70"}`} />
                          )}
                        </span>
                      )}
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="bg-gradient h-1.5 w-1.5 rounded-full" /> Registered</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-pink/70" /> Saved</span>
      </div>
    </div>
  );
}
