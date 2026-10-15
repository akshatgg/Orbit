import { formatAnswer } from "./answers";
import { STATUS_LABELS, type Guest, type GuestQuestion } from "./types";

/**
 * Escapes one CSV cell (RFC 4180): quotes cells containing commas, quotes or line breaks and
 * doubles inner quotes. Cells that a spreadsheet would run as a formula (=, +, -, @, tab, CR)
 * get a leading apostrophe so a guest's answer can't execute in Excel / Sheets.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows → CSV text with CRLF line endings (what Excel expects). */
export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** ISO timestamp → "2026-10-16 18:32" in UK time, or "" when missing. */
export function csvDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** The guest list export: fixed columns, then one column per application question. */
export function buildGuestCsv(guests: Guest[], questions: GuestQuestion[]): string {
  const header = ["Name", "Email", "Status", "Ticket", "Registered at", "Checked in at", ...questions.map((q) => q.label)];
  const rows = guests.map((g) => [
    g.name ?? "",
    g.email ?? "",
    STATUS_LABELS[g.status] ?? g.status,
    g.ticket ?? "",
    csvDate(g.registeredAt),
    csvDate(g.checkedInAt),
    ...questions.map((q) => formatAnswer(g.answers?.[q.id])),
  ]);
  return toCsv([header, ...rows]);
}

/** "Case Interview Bootcamp" → "case-interview-bootcamp-guests.csv". */
export function csvFilename(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${slug || "event"}-guests.csv`;
}
