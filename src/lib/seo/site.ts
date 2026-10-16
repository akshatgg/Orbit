/** Canonical origin of the site (no trailing slash). */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://orbit.akshatgg.in").replace(/\/$/, "");
export const SITE_NAME = "ORBIT";
export const SITE_TAGLINE = "Explore opportunities";
export const SITE_TITLE = "ORBIT — Career events, networking & socials";
export const SITE_DESCRIPTION =
  "ORBIT is where students and early-career people find career fairs, employer talks, networking nights and society socials — ranked for you, with one-tap tickets and calendar sync.";

export const absoluteUrl = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
