import type { GuestQuestion } from "./types";

/** Turns a stored answer (text, list, yes/no) into display text. Empty → "". */
export function formatAnswer(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(formatAnswer).filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

/**
 * Answers paired with their question labels, in question order. Answers to questions that
 * no longer exist are kept at the end under their raw key so nothing is silently lost.
 */
export function labelledAnswers(answers: Record<string, unknown> | null | undefined, questions: GuestQuestion[]) {
  const source = answers ?? {};
  const known = new Set(questions.map((q) => q.id));
  const rows = questions.map((q) => ({ id: q.id, label: q.label, answer: formatAnswer(source[q.id]) }));
  for (const [key, value] of Object.entries(source)) {
    if (!known.has(key)) rows.push({ id: key, label: key, answer: formatAnswer(value) });
  }
  return rows.filter((r) => r.answer !== "");
}
