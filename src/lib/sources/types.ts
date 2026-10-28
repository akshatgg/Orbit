// Types for approved event sources, as the Orbit API's /admin/sources endpoints return them.
// The importers themselves run on the API.

export const SOURCE_KINDS = ["ical", "luma", "luma-discover", "meetup", "meetup-search", "eventbrite", "fatsoma"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  ical: "iCal feed",
  luma: "Luma calendar",
  "luma-discover": "Luma link",
  meetup: "Meetup group",
  "meetup-search": "Meetup link",
  eventbrite: "Eventbrite link",
  fatsoma: "Fatsoma link",
};

/** Kinds whose events link to a platform page and can be filled in from the details editor. */
export const IMPORTED_KINDS = ["luma", "luma-discover", "meetup", "meetup-search", "eventbrite", "fatsoma"] as const satisfies readonly SourceKind[];
export type ImportedKind = (typeof IMPORTED_KINDS)[number];

export type RunStatus = "ok" | "error";
export type RunTrigger = "cron" | "manual";

export type EventSource = {
  id: string;
  name: string;
  kind: SourceKind;
  url: string;
  default_organiser_id: string | null;
  default_category_id: string | null;
  default_tags: string[];
  /** Score each imported event against category keywords instead of forcing the default category. */
  auto_category: boolean;
  attribution: string | null;
  permission_confirmed: boolean;
  permission_note: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_status: RunStatus | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RunError = { event?: string; message: string };

export type SourceRun = {
  id: string;
  source_id: string;
  trigger: RunTrigger;
  started_at: string;
  finished_at: string | null;
  status: RunStatus;
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  flagged_missing: number;
  enriched: number;
  errors: RunError[];
};

/** Prefix used in events.source for events that came from an event_sources row. */
export const sourceKey = (sourceId: string) => `source:${sourceId}`;

export function sourceIdFromKey(source: string): string | null {
  return source.startsWith("source:") ? source.slice("source:".length) : null;
}

export type RunSummary = {
  sourceId: string;
  name: string;
  status: RunStatus;
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  flaggedMissing: number;
  /** Events whose page details (cover, description, price) were saved this run. */
  enriched: number;
  /** New events the keyword classifier categorised (rather than the source default). */
  classified?: number;
  errors: RunError[];
};

export type DetailsStatus = "ok" | "failed" | "blocked";

/** One row per imported event whose source page ORBIT has tried to read. */
export type SourceEventDetails = {
  event_id: string;
  status: DetailsStatus;
  attempts: number;
  last_error: string | null;
  fetched_at: string;
};

/** A full refresh of every enabled source (the nightly cron, or "Refresh all now"). */
export type RefreshSummary = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  sources: RunSummary[];
  expired: number;
  duplicatesFlagged: number;
  errors: string[];
};
