// Text clean-up for imported events: strip HTML, tidy whitespace, enforce length limits.

export const LIMITS = {
  title: 140, // events.title check constraint
  summary: 200, // events.summary check constraint
  description: 5000,
  venue: 200,
  address: 300,
  url: 2000,
} as const;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", pound: "£", euro: "€", copy: "©",
};

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Turns HTML (or plain text) into tidy plain text, keeping paragraph breaks. */
export function stripHtml(input: string | null | undefined) {
  if (!input) return "";
  return decodeEntities(
    input
      .replace(/\r\n?/g, "\n")
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Single-line version: all whitespace collapsed. */
export function oneLine(input: string | null | undefined) {
  return stripHtml(input).replace(/\s+/g, " ").trim();
}

/** Cuts text to `max` characters on a word boundary, adding "…" when cut. */
export function clamp(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace >= max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Empty strings become null. */
export const orNull = (s: string) => (s.length ? s : null);

/** The first sentence / line of a description, short enough for an event card. */
export function summarise(description: string | null) {
  if (!description) return null;
  const firstPara = description.split("\n").find((l) => l.trim().length > 0) ?? "";
  return orNull(clamp(firstPara.trim(), LIMITS.summary));
}

/** Only absolute http(s) URLs survive. */
export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const s = url.toString();
    return s.length <= LIMITS.url ? s : null;
  } catch {
    return null;
  }
}
