// Pure "should the opening animation play?" decision. Serialised into the inline head script
// (see intro-script.ts), so it must stay dependency free and use only plain JavaScript syntax.

export const INTRO_SEEN_KEY = "orbit-intro-seen";

export type IntroDecisionInput = {
  /** location.search, e.g. "?intro=1". */
  search: string;
  userAgent: string;
  /** navigator.webdriver */
  webdriver: boolean;
  /** The session flag has been set already. */
  seen: boolean;
};

export function shouldPlayIntro(input: IntroDecisionInput): boolean {
  const m = /[?&]intro=([^&#]*)/.exec(input.search || "");
  const flag = m ? m[1] : "";
  if (flag === "0") return false;
  if (flag === "1") return true;
  if (input.webdriver) return false;
  if (/bot|crawl|spider|slurp|lighthouse|headless/i.test(input.userAgent || "")) return false;
  return !input.seen;
}
