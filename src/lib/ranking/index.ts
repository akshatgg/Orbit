// Transparent, rule-based recommendations.
//
// Every event gets a score made of named signals. Each signal carries a weight and a short,
// human-readable reason, so the feed can say *why* something was recommended:
// "Recommended because you're into consulting and you follow Imperial Consulting Society".
//
// Pure and deterministic: no I/O, no hidden clock (pass `now`), stable ordering.

import type { Profile, RegistrationStatus } from "@/types/database";
import type { EventCardData, EventCounts } from "@/lib/events/queries";
import { CAREER_INTERESTS, DAY_PARTS, PERSONAL_INTERESTS } from "@/lib/taxonomy";

// ─── Inputs ─────────────────────────────────────────────────────────────────

export type RankProfile = Pick<
  Profile,
  | "career_interests" | "personal_interests" | "preferred_categories" | "preferred_formats"
  | "availability" | "university" | "department" | "course"
>;

/** An event card plus the extras ranking can use (both optional). */
export type RankableEvent = EventCardData & {
  counts?: EventCounts;
  /** Not part of EVENT_CARD_SELECT; treated as `true` (the column default) when missing. */
  waitlist_enabled?: boolean | null;
};

/** What the user has already done. `MyEventState` from lib/events/queries fits this shape. */
export type RankState = {
  dismissed: ReadonlySet<string>;
  registrations: ReadonlyMap<string, RegistrationStatus>;
  externalRegistered?: ReadonlySet<string>;
};

export type RankContext = {
  followedOrganiserIds: ReadonlySet<string>;
  state?: RankState;
  now: Date;
};

// ─── Weights ────────────────────────────────────────────────────────────────

export const WEIGHTS = {
  careerInterest: 30,
  careerInterestExtra: 8,
  careerInterestMax: 40,
  followedOrganiser: 25,
  personalInterest: 15,
  personalInterestExtra: 5,
  personalInterestMax: 20,
  preferredCategory: 12,
  courseMatch: 10,
  deadlineSoon: 10,
  availability: 8,
  sameUniversity: 6,
  popularityMax: 6,
  preferredFormat: 5,
  featured: 5,
  startingSoon: 4,
  fullWithWaitlist: -3,
  fullNoWaitlist: -20,
  registrationClosed: -25,
} as const;

/** Going-count at which the popularity signal maxes out. */
const POPULARITY_CAP = 50;
/** Show "N people are going" as a reason from this many guests. */
const POPULARITY_REASON_MIN = 10;
const HOUR = 36e5;
const DAY = 24 * HOUR;

/** Registrations that already put the event in the user's Tickets tab. */
export const ACTIVE_REGISTRATION: readonly RegistrationStatus[] = ["going", "pending", "waitlisted", "awaiting_payment"];

// ─── Output ─────────────────────────────────────────────────────────────────

export type SignalKey =
  | "careerInterest" | "followedOrganiser" | "personalInterest" | "preferredCategory" | "courseMatch"
  | "deadlineSoon" | "availability" | "sameUniversity" | "popularity" | "preferredFormat" | "featured"
  | "startingSoon" | "full" | "registrationClosed";

export type Signal = { key: SignalKey; weight: number; reason: string | null };

export type Exclusion = "dismissed" | "unavailable" | "ended" | "registered";

export type Scored<E extends RankableEvent = RankableEvent> = {
  event: E;
  score: number;
  signals: Signal[];
  /** "Recommended because …", or null when nothing personal matched. */
  reason: string | null;
  excluded: Exclusion | null;
};

// ─── Wording ────────────────────────────────────────────────────────────────

const CAREER_PHRASE: Record<string, string> = {
  consulting: "consulting",
  finance: "finance",
  technology: "tech",
  marketing: "marketing",
  entrepreneurship: "entrepreneurship",
  product: "product management",
  data: "data & analytics",
  sustainability: "sustainability",
  healthcare: "healthcare",
  "public-sector": "policy",
  law: "law",
  creative: "the creative industries",
};

const PERSONAL_PHRASE: Record<string, string> = {
  socialising: "socialising",
  fitness: "fitness",
  travel: "travel",
  sustainability: "sustainability",
  arts: "arts & culture",
  music: "music",
  food: "food & drink",
  wellbeing: "wellbeing",
  volunteering: "volunteering",
  gaming: "gaming",
};

/** Category slugs that imply an interest even when the organiser didn't tag it. */
const CATEGORY_TOPICS: Record<string, string[]> = {
  fitness: ["fitness"],
  social: ["socialising"],
  networking: ["socialising"],
  "arts-culture": ["arts"],
  sustainability: ["sustainability"],
  entrepreneurship: ["entrepreneurship"],
};

/** Free-text tags that mean the same thing as a taxonomy value. */
const TAG_SYNONYMS: Record<string, string> = {
  tech: "technology",
  startups: "entrepreneurship",
  startup: "entrepreneurship",
  banking: "finance",
  "investment banking": "finance",
  esg: "sustainability",
  "net zero": "sustainability",
  analytics: "data",
  "data science": "data",
  "product management": "product",
  policy: "public-sector",
  running: "fitness",
  sport: "fitness",
  sports: "fitness",
  social: "socialising",
  art: "arts",
  "arts & culture": "arts",
  culture: "arts",
  "food & drink": "food",
  nightlife: "music",
};

const FORMAT_PHRASE = { in_person: "it's in person", online: "it's online", hybrid: "it's hybrid" } as const;

const WEEKDAY_NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const DAY_PART_PLURAL: Record<string, string> = { morning: "mornings", day: "afternoons", evening: "evenings" };

/** "consulting & finance" — "&" inside a reason so the sentence's own "and" stays readable. */
const joinPair = (items: string[]) => items.slice(0, 2).join(" & ");

const norm = (s: string) => s.trim().toLowerCase().replace(/[_]+/g, "-").replace(/\s+/g, " ");

const careerValues = new Set<string>(CAREER_INTERESTS.map((c) => c.value));
const personalValues = new Set<string>(PERSONAL_INTERESTS.map((p) => p.value));

/** Normalised topics an event is about: its tags (+ synonyms) and what its category implies. */
export function eventTopics(event: Pick<EventCardData, "tags" | "category">): Set<string> {
  const topics = new Set<string>();
  for (const raw of event.tags ?? []) {
    const t = norm(raw);
    if (!t) continue;
    topics.add(t);
    topics.add(t.replace(/ /g, "-"));
    const syn = TAG_SYNONYMS[t];
    if (syn) topics.add(syn);
  }
  const slug = event.category?.slug;
  if (slug) for (const t of CATEGORY_TOPICS[slug] ?? []) topics.add(t);
  return topics;
}

// ─── UK local time ──────────────────────────────────────────────────────────

const ukParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", weekday: "short", hour: "2-digit", hourCycle: "h23",
});

/** Weekday ("mon"…"sun") and hour (0–23) of an instant in UK local time. */
export function ukWeekdayHour(d: Date): { weekday: string; hour: number } {
  const parts = ukParts.formatToParts(d);
  const weekday = (parts.find((p) => p.type === "weekday")?.value ?? "").slice(0, 3).toLowerCase();
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  return { weekday, hour };
}

/** Day part ("morning" / "day" / "evening") for an hour, using DAY_PARTS. */
export function dayPartFor(hour: number): string | null {
  return DAY_PARTS.find((p) => hour >= p.hours[0] && hour < p.hours[1])?.value ?? null;
}

/** Reads the profile's availability JSON ({"mon": ["evening"]}) defensively. */
export function parseAvailability(raw: unknown): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [day, parts] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(parts)) continue;
    const set = new Set(parts.filter((p): p is string => typeof p === "string"));
    if (set.size) out.set(day.slice(0, 3).toLowerCase(), set);
  }
  return out;
}

// ─── Scoring ────────────────────────────────────────────────────────────────

function deadlineReason(ms: number) {
  if (ms < HOUR * 1.5) return "registration closes within the hour";
  if (ms < DAY) return `registration closes in ${Math.round(ms / HOUR)} hours`;
  const days = Math.round(ms / DAY);
  return `registration closes in ${days} day${days === 1 ? "" : "s"}`;
}

function isFull(event: RankableEvent) {
  if (event.registration_mode !== "tickets" || event.capacity === null || !event.counts) return false;
  return event.capacity - event.counts.going - event.counts.pending <= 0;
}

/** Why an event should not be recommended at all, or null. */
export function exclusionFor(event: RankableEvent, ctx: RankContext): Exclusion | null {
  const state = ctx.state;
  if (event.status !== "published") return "unavailable";
  const now = ctx.now.getTime();
  const end = event.ends_at ? new Date(event.ends_at).getTime() : new Date(event.starts_at).getTime();
  if (end < now) return "ended";
  if (state?.dismissed.has(event.id)) return "dismissed";
  const reg = state?.registrations.get(event.id);
  if (reg && ACTIVE_REGISTRATION.includes(reg)) return "registered";
  if (state?.externalRegistered?.has(event.id)) return "registered";
  return null;
}

/** All matching signals for one event, strongest first. */
export function scoreSignals(event: RankableEvent, profile: RankProfile, ctx: RankContext): Signal[] {
  const signals: Signal[] = [];
  const now = ctx.now.getTime();
  const starts = new Date(event.starts_at).getTime();
  const topics = eventTopics(event);

  // Career interests
  const career = (profile.career_interests ?? []).filter((c) => careerValues.has(c) || CAREER_PHRASE[c]);
  const careerHits = career.filter((c) => topics.has(c));
  if (careerHits.length) {
    const weight = Math.min(
      WEIGHTS.careerInterestMax,
      WEIGHTS.careerInterest + (careerHits.length - 1) * WEIGHTS.careerInterestExtra,
    );
    const phrases = careerHits.slice(0, 2).map((c) => CAREER_PHRASE[c] ?? c.replace(/-/g, " "));
    signals.push({ key: "careerInterest", weight, reason: `you're into ${joinPair(phrases)}` });
  }

  // Followed organiser
  if (event.organiser_id && ctx.followedOrganiserIds.has(event.organiser_id)) {
    signals.push({
      key: "followedOrganiser",
      weight: WEIGHTS.followedOrganiser,
      reason: event.organiser ? `you follow ${event.organiser.name}` : "you follow the organiser",
    });
  }

  // Personal interests (skip ones already counted as a career match, e.g. sustainability)
  const personalHits = (profile.personal_interests ?? [])
    .filter((p) => (personalValues.has(p) || PERSONAL_PHRASE[p]) && !careerHits.includes(p))
    .filter((p) => topics.has(p));
  if (personalHits.length) {
    const weight = Math.min(
      WEIGHTS.personalInterestMax,
      WEIGHTS.personalInterest + (personalHits.length - 1) * WEIGHTS.personalInterestExtra,
    );
    const phrases = personalHits.slice(0, 2).map((p) => PERSONAL_PHRASE[p] ?? p.replace(/-/g, " "));
    signals.push({ key: "personalInterest", weight, reason: `you enjoy ${joinPair(phrases)}` });
  }

  // Preferred category
  if (event.category && (profile.preferred_categories ?? []).includes(event.category.slug)) {
    signals.push({
      key: "preferredCategory",
      weight: WEIGHTS.preferredCategory,
      reason: `you like ${event.category.name.toLowerCase()} events`,
    });
  }

  // Course / department mentioned in the event's tags
  const courseHit = [profile.course, profile.department]
    .filter((v): v is string => !!v && v.trim().length > 2)
    .find((v) => topics.has(norm(v)));
  if (courseHit) {
    signals.push({ key: "courseMatch", weight: WEIGHTS.courseMatch, reason: `it's aimed at ${courseHit} students` });
  }

  // Registration deadline
  if (event.registration_deadline && event.registration_mode !== "none") {
    const left = new Date(event.registration_deadline).getTime() - now;
    if (left <= 0) {
      signals.push({ key: "registrationClosed", weight: WEIGHTS.registrationClosed, reason: null });
    } else if (left <= 3 * DAY) {
      signals.push({ key: "deadlineSoon", weight: WEIGHTS.deadlineSoon, reason: deadlineReason(left) });
    }
  }

  // Availability (UK local weekday + part of day)
  const availability = parseAvailability(profile.availability);
  if (availability.size) {
    const { weekday, hour } = ukWeekdayHour(new Date(event.starts_at));
    const part = dayPartFor(hour);
    if (part && availability.get(weekday)?.has(part)) {
      signals.push({
        key: "availability",
        weight: WEIGHTS.availability,
        reason: `you're free on ${WEEKDAY_NAMES[weekday] ?? weekday} ${DAY_PART_PLURAL[part] ?? part}`,
      });
    }
  }

  // Same university
  if (event.university && profile.university && norm(event.university) === norm(profile.university)) {
    signals.push({
      key: "sameUniversity",
      weight: WEIGHTS.sameUniversity,
      reason: `it's for ${event.university} students`,
    });
  }

  // Popularity
  const going = event.counts?.going ?? 0;
  if (going > 0) {
    const weight = Math.round((Math.min(going, POPULARITY_CAP) / POPULARITY_CAP) * WEIGHTS.popularityMax * 100) / 100;
    signals.push({
      key: "popularity",
      weight,
      reason: going >= POPULARITY_REASON_MIN ? `${going} people are going` : null,
    });
  }

  // Preferred format (hybrid suits both in-person and online people)
  const formats = profile.preferred_formats ?? [];
  if (formats.length) {
    const fmt = event.format as keyof typeof FORMAT_PHRASE;
    const fits = formats.includes(fmt) || (fmt === "hybrid" && (formats.includes("in_person") || formats.includes("online")));
    if (fits) signals.push({ key: "preferredFormat", weight: WEIGHTS.preferredFormat, reason: FORMAT_PHRASE[fmt] ?? null });
  }

  // Featured
  if (event.is_featured) signals.push({ key: "featured", weight: WEIGHTS.featured, reason: "it's featured on ORBIT" });

  // Starting soon (within 48 hours)
  const until = starts - now;
  if (until > 0 && until <= 2 * DAY) {
    signals.push({
      key: "startingSoon",
      weight: WEIGHTS.startingSoon,
      reason: until <= 12 * HOUR ? "it's happening very soon" : "it's coming up in the next two days",
    });
  }

  // Full
  if (isFull(event)) {
    const waitlist = event.waitlist_enabled ?? true;
    signals.push({ key: "full", weight: waitlist ? WEIGHTS.fullWithWaitlist : WEIGHTS.fullNoWaitlist, reason: null });
  }

  return signals.sort((a, b) => b.weight - a.weight);
}

/** "Recommended because A and B" from the two strongest positive reasons. */
export function buildReason(signals: Signal[]): string | null {
  const reasons = signals
    .filter((s) => s.weight > 0 && s.reason)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((s) => s.reason as string);
  if (!reasons.length) return null;
  return `Recommended because ${reasons.join(" and ")}`;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function scoreEvent<E extends RankableEvent>(event: E, profile: RankProfile, ctx: RankContext): Scored<E> {
  const signals = scoreSignals(event, profile, ctx);
  return {
    event,
    score: round(signals.reduce((sum, s) => sum + s.weight, 0)),
    signals,
    reason: buildReason(signals),
    excluded: exclusionFor(event, ctx),
  };
}

/** Highest score first; ties go to the event that starts sooner, then by id. */
export function compareScored(a: Scored, b: Scored) {
  if (b.score !== a.score) return b.score - a.score;
  const t = new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime();
  if (t !== 0) return t;
  return a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0;
}

export type RankOptions = {
  /**
   * Keep events the user already has (registered / dismissed) — for search, where people expect
   * to find everything. Unpublished and finished events are always dropped.
   */
  keepPersonal?: boolean;
};

/** Scores, filters and sorts events for one person. */
export function rankEvents<E extends RankableEvent>(
  events: readonly E[],
  profile: RankProfile,
  ctx: RankContext,
  options: RankOptions = {},
): Scored<E>[] {
  return events
    .map((e) => scoreEvent(e, profile, ctx))
    .filter((s) => {
      if (!s.excluded) return true;
      return options.keepPersonal ? s.excluded === "dismissed" || s.excluded === "registered" : false;
    })
    .sort(compareScored);
}
