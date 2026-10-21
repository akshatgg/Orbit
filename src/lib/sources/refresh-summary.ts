import type { RefreshSummary, RunSummary } from "./types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One line for the admin, e.g. "3 sources · 12 new · 4 updated · 20 unchanged · 1 possible duplicate". */
export function formatRefreshSummary(summary: RefreshSummary): string {
  const total = (key: "inserted" | "updated" | "unchanged" | "enriched") =>
    summary.sources.reduce((n, s: RunSummary) => n + (s[key] ?? 0), 0);
  const parts = [
    plural(summary.sources.length, "source"),
    `${total("inserted")} new`,
    `${total("updated")} updated`,
    `${total("unchanged")} unchanged`,
  ];
  const enriched = total("enriched");
  if (enriched) parts.push(`${enriched} with page details`);
  const categorised = summary.sources.reduce((n, s: RunSummary) => n + (s.classified ?? 0), 0);
  if (categorised) parts.push(`${categorised} categorised`);
  if (summary.duplicatesFlagged) parts.push(plural(summary.duplicatesFlagged, "possible duplicate"));
  const failed = summary.sources.filter((s) => s.status === "error").length;
  if (failed) parts.push(`${failed} failed`);
  return parts.join(" · ");
}
