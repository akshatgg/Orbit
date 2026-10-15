// Branded HTML emails as plain string templates (table layout + inline styles for email clients).

import { esc, type Message } from "./messages";

// Brand tokens (mirrors globals.css; email clients can't read CSS variables).
const C = {
  bg: "#05040c",
  surface: "#0e0d1a",
  surface2: "#161428",
  line: "#24213b",
  fg: "#ffffff",
  muted: "#a9a3c4",
  violet: "#b57cf6",
  blue: "#3f79fd",
};
const GRADIENT = "linear-gradient(135deg,#de9ffb 0%,#3f79fd 35%,#f4e4d4 70%,#fdb570 100%)";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";

export type RenderedEmail = { subject: string; html: string; text: string };

/** Absolute URL for an app path (emails need full links). */
export function absoluteUrl(path: string, appUrl: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${appUrl.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** HTML fragment → plain text (for the text/plain part). */
export function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&ldquo;", "“")
    .replaceAll("&rdquo;", "”")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

export function renderEmail(message: Message, appUrl: string): RenderedEmail {
  const m = message.email;
  const ctaUrl = absoluteUrl(m.cta.url, appUrl);
  const settingsUrl = absoluteUrl("/profile", appUrl);

  const paragraphs = m.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.muted};">${p}</p>`)
    .join("");

  const details = m.details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;background:${C.surface2};border:1px solid ${C.line};border-radius:14px;">
        ${m.details
          .map(
            (d, i) => `<tr><td style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ""}">
              <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.violet};">${esc(d.label)}</div>
              <div style="margin-top:3px;font-size:14px;line-height:1.5;color:${C.fg};">${esc(d.value)}</div>
            </td></tr>`,
          )
          .join("")}
      </table>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(m.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT};color:${C.fg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(m.preheader)}&#8203;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
  <tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.surface};border:1px solid ${C.line};border-radius:20px;overflow:hidden;">
      <tr><td align="center" bgcolor="${C.blue}" style="background:${C.blue};background-image:${GRADIENT};padding:26px 20px;">
        <div style="font-size:22px;font-weight:800;letter-spacing:0.42em;color:${C.bg};padding-left:0.42em;">ORBIT</div>
        <div style="margin-top:4px;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:${C.bg};opacity:0.75;">Explore opportunities</div>
      </td></tr>
      <tr><td style="padding:28px 24px 8px;">
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:700;color:${C.fg};">${esc(m.heading)}</h1>
        ${paragraphs}
        ${details}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;">
          <tr><td align="center" bgcolor="${C.violet}" style="border-radius:12px;background:${C.violet};background-image:${GRADIENT};">
            <a href="${esc(ctaUrl)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:${C.bg};text-decoration:none;border-radius:12px;">${esc(m.cta.label)}</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 24px 24px;border-top:1px solid ${C.line};">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${C.muted};">
          You're getting this because of an event you saved or registered for on ORBIT.
          <a href="${esc(settingsUrl)}" style="color:${C.violet};">Manage reminders</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    "ORBIT",
    "",
    m.heading,
    "",
    ...m.paragraphs.map(htmlToText),
    ...(m.details.length ? ["", ...m.details.map((d) => `${d.label}: ${d.value}`)] : []),
    "",
    `${m.cta.label}: ${ctaUrl}`,
    "",
    "--",
    `You're getting this because of an event you saved or registered for on ORBIT. Manage reminders: ${settingsUrl}`,
  ].join("\n");

  return { subject: m.subject, html, text };
}
