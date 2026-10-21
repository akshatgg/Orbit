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

/** Decorative lines made only of Markdown / iCal separator characters. */
const SEPARATOR_LINE = /^[ \t]*[\\|*_=~+\-–—]{3,}[ \t]*$/gm;

/**
 * Markdown authors often write every ordered-list item as `1.` and let the renderer number them.
 * The event page is plain text, so renumber each consecutive list block (blank lines between
 * items are allowed).
 */
function renumberOrderedLists(input: string) {
  const lines = input.split("\n");
  let number = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const item = line.match(/^[ \t]*\d+[.)][ \t]+(.*)$/);
    if (item) {
      number += 1;
      lines[i] = `${number}. ${item[1]}`;
      continue;
    }

    if (line.trim() === "") {
      let next = i + 1;
      while (next < lines.length && lines[next].trim() === "") next++;
      if (next >= lines.length || !/^[ \t]*\d+[.)][ \t]+/.test(lines[next])) number = 0;
      continue;
    }

    // An indented line is normally a wrapped continuation of the current list item.
    if (number > 0 && /^[ \t]+\S/.test(line)) continue;
    number = 0;
  }

  return lines.join("\n");
}

/**
 * Turns lightweight Markdown / iCal prose into readable plain text. Event pages render plain
 * text, so markers would otherwise show up literally: `**bold**`, `[label](url)`,
 * `-\|\-\|…` divider lines, escaped punctuation and bullet asterisks.
 *
 * Deliberately conservative: it only removes markers that pair up, so ordinary prose (including
 * `2 * 3` or `C++`) is left alone.
 */
export function cleanProse(input: string | null | undefined, { keepEmphasis = false }: { keepEmphasis?: boolean } = {}) {
  if (!input) return "";
  let text = input
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ");

  // Escaped punctuation from Markdown / iCal: \- \| \* \[ \] \( \) \,
  text = text.replace(/\\([\\`*_{}\[\]()#+\-.!|>~,])/g, "$1");

  // Markdown images and links become normal prose; the page linkifies URLs itself.
  text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label: string, url: string) =>
    label.trim() === url ? url : `${label.trim()} (${url})`,
  );

  // Bullets first, so a leading `*` can't pair with an emphasis marker later in the line.
  text = text.replace(/^[ \t]*[*+-][ \t]+/gm, "• ");

  // Emphasis, strikethrough and inline code. Event descriptions keep bold/italic markers so
  // RichText can render them; summaries strip them.
  if (keepEmphasis) {
    text = text.replace(/(__)(?=\S)([\s\S]*?\S)\1/g, "**$2**");
    text = text.replace(/(^|[\s(])_(?=\S)([^_\n]*?\S)_(?=$|[\s).,!?:;])/gm, "$1*$2*");
  } else {
    text = text.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2");
    text = text.replace(/\*(?=\S)([^*\n]*?\S)\*/g, "$1");
    text = text.replace(/(^|[\s(])_(?=\S)([^_\n]*?\S)_(?=$|[\s).,!?:;])/gm, "$1$2");
  }
  text = text.replace(/~~(?=\S)([^~\n]*?\S)~~/g, "$1");
  text = text.replace(/`([^`\n]+)`/g, "$1");

  // Headings and block quotes.
  text = text.replace(/^[ \t]*#{1,6}[ \t]+/gm, "");
  text = text.replace(/^[ \t]*>[ \t]?/gm, "");

  // Divider lines and any remaining standalone marker runs.
  text = text.replace(SEPARATOR_LINE, "");
  text = text.replace(/(^|\s)[*_~]{2,}(?=\s|$)/g, "$1");
  text = renumberOrderedLists(text);

  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** `**x**` around `inner`, with its surrounding spaces kept outside (RichText needs `**x**`). */
function emphasise(marker: string, inner: string) {
  const [, lead, core, trail] = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  return core.replace(/<[^>]+>/g, "").trim() ? `${lead}${marker}${core}${marker}${trail}` : inner;
}

/**
 * An HTML description (Eventbrite, Fatsoma) in the stored description format: paragraphs and
 * lists as plain text, bold / italic / headings as `**` / `*`, links as "label (url)". Images go.
 */
export function htmlToProse(html: string | null | undefined): string | null {
  if (!html) return null;
  const marked = html
    .replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const url = safeHttpUrl(decodeEntities(href));
      const text = oneLine(label);
      return url && text && text !== url ? `${text} (${url})` : text || url || "";
    })
    .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag: string, inner: string) => {
      const text = oneLine(inner);
      return text ? `<p>**${text}**</p>` : "";
    })
    .replace(/<(strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (_, _tag: string, inner: string) => emphasise("**", inner))
    .replace(/<(em|i)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (_, _tag: string, inner: string) => emphasise("*", inner))
    // A blank line between blocks, as in every stored description; list items stay one per line.
    .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote)>/gi, "</$1>\n");
  return orNull(clamp(cleanProse(stripHtml(marked), { keepEmphasis: true }), LIMITS.description));
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
  return orNull(clamp(cleanProse(firstPara), LIMITS.summary));
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
