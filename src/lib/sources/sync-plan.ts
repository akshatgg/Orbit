// Pure diff between what a source sent and what ORBIT already has for that source.

import type { EventFormat, RegistrationMode } from "@/types/database";
import type { EventSource, NormalizedEvent, SourceKind } from "./types";
import { sourceKey } from "./types";

/** Columns of events that a sync reads for one source. */
export const EXISTING_EVENT_SELECT =
  "id, source_event_id, title, summary, description, starts_at, ends_at, timezone, format, venue_name, address, latitude, longitude, registration_mode, external_url, source_url, status, needs_review, last_verified_at";

export type ExistingSourceEvent = {
  id: string;
  source_event_id: string | null;
  title: string;
  summary: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  format: EventFormat;
  venue_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  registration_mode: RegistrationMode;
  external_url: string | null;
  source_url: string | null;
  status: string;
  needs_review: boolean;
  last_verified_at: string;
};

/** Fields a source owns on its events (kept in sync on every run). */
export type SyncedFields = {
  title: string;
  summary: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  format: EventFormat;
  venue_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  registration_mode?: RegistrationMode;
  external_url?: string | null;
  source_url: string | null;
};

/** Label on the "register" button of imported events, by source kind. */
export const EXTERNAL_LABELS: Record<SourceKind, string> = {
  ical: "View details",
  luma: "Register on Luma",
  meetup: "Register on Meetup",
};

/** Synced fields a kind's feed doesn't really have, so updates leave them alone.
 *  - Luma's feed only carries a stub description; the real one comes from the page or an admin.
 *  - Meetup's feed usually has no LOCATION/GEO; venue and coordinates come from its event page,
 *    so a later feed sync must not wipe them back to null. */
export const SKIPPED_FIELDS: Partial<Record<SourceKind, readonly (keyof SyncedFields)[]>> = {
  luma: ["description"],
  meetup: ["venue_name", "address", "latitude", "longitude"],
};

/** Public provenance link: the event's own page, else the feed's site (never the full feed URL,
 *  which can contain a private token). */
export function provenanceUrl(event: Pick<NormalizedEvent, "url">, feedUrl: string) {
  if (event.url) return event.url;
  try {
    return new URL(feedUrl).origin;
  } catch {
    return null;
  }
}

export function syncedFields(event: NormalizedEvent, feedUrl: string): SyncedFields {
  return {
    title: event.title,
    summary: event.summary,
    description: event.description,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    timezone: event.timezone,
    format: event.format,
    venue_name: event.venueName,
    address: event.address,
    latitude: event.latitude,
    longitude: event.longitude,
    registration_mode: event.url ? "external" : "none",
    external_url: event.url,
    source_url: provenanceUrl(event, feedUrl),
  };
}

/** Row to insert for an event we haven't seen before. */
export function buildInsertRow(
  event: NormalizedEvent,
  source: Pick<EventSource, "id" | "url" | "default_organiser_id" | "default_category_id" | "default_tags"> & { kind?: SourceKind },
  now: Date,
) {
  return {
    ...syncedFields(event, source.url),
    source: sourceKey(source.id),
    source_event_id: event.sourceEventId,
    external_label: EXTERNAL_LABELS[source.kind ?? "ical"],
    organiser_id: source.default_organiser_id,
    category_id: source.default_category_id,
    tags: source.default_tags,
    status: "published" as const,
    last_verified_at: now.toISOString(),
  };
}

const sameInstant = (a: string | null, b: string | null) =>
  a === b || (a !== null && b !== null && new Date(a).getTime() === new Date(b).getTime());

/** Coordinates may come back from PostgREST as a number or a numeric string. */
const sameCoordinate = (a: unknown, b: unknown) =>
  a == null || b == null ? a == null && b == null : Number(a) === Number(b);

/** Only the fields that actually changed (empty object when nothing did). */
export function changedFields(
  existing: ExistingSourceEvent,
  incoming: SyncedFields,
  skip: readonly (keyof SyncedFields)[] = [],
): Partial<SyncedFields> {
  const patch: Partial<SyncedFields> = {};
  const next = { ...incoming };
  for (const key of skip) delete next[key];
  // An admin switched this event to ORBIT tickets — leave registration alone.
  if (existing.registration_mode === "tickets") {
    delete next.registration_mode;
    delete next.external_url;
  }
  for (const key of Object.keys(next) as (keyof SyncedFields)[]) {
    const a = existing[key] ?? null;
    const b = next[key] ?? null;
    const same =
      key === "starts_at" || key === "ends_at" ? sameInstant(a as string | null, b as string | null)
      : key === "latitude" || key === "longitude" ? sameCoordinate(a, b)
      : a === b;
    if (!same) (patch as Record<string, unknown>)[key] = b;
  }
  return patch;
}

export type SyncPlan = {
  inserts: NormalizedEvent[];
  updates: { id: string; sourceEventId: string; patch: Partial<SyncedFields> }[];
  unchanged: string[];
  /** Upcoming events no longer in the feed, or cancelled at the source → needs_review. */
  flagged: { id: string; reason: "missing" | "cancelled" }[];
};

const LIVE_STATUSES = new Set(["published", "draft"]);

/**
 * Works out inserts / updates / unchanged / flags. Events are matched by source_event_id.
 * ORBIT never auto-cancels: events that vanish or are cancelled upstream are only flagged,
 * and only on the run where they first go missing (seen in the previous successful run),
 * so an admin's "Mark reviewed" sticks.
 */
export function planSync(
  existing: ExistingSourceEvent[],
  incoming: NormalizedEvent[],
  { now, feedUrl, previousRunStartedAt, skip = [] }: {
    now: Date;
    feedUrl: string;
    previousRunStartedAt: Date | null;
    skip?: readonly (keyof SyncedFields)[];
  },
): SyncPlan {
  const plan: SyncPlan = { inserts: [], updates: [], unchanged: [], flagged: [] };
  const byId = new Map(existing.filter((e) => e.source_event_id).map((e) => [e.source_event_id!, e]));
  const seenIds = new Set<string>();

  const wasSeenLastRun = (e: ExistingSourceEvent) =>
    !previousRunStartedAt || new Date(e.last_verified_at).getTime() >= previousRunStartedAt.getTime();
  const flag = (e: ExistingSourceEvent, reason: "missing" | "cancelled") => {
    if (!e.needs_review && LIVE_STATUSES.has(e.status) && wasSeenLastRun(e)) plan.flagged.push({ id: e.id, reason });
  };

  for (const event of incoming) {
    if (seenIds.has(event.sourceEventId)) continue;
    seenIds.add(event.sourceEventId);
    const current = byId.get(event.sourceEventId);
    if (event.cancelled) {
      if (current) flag(current, "cancelled");
      continue;
    }
    if (!current) {
      plan.inserts.push(event);
      continue;
    }
    const patch = changedFields(current, syncedFields(event, feedUrl), skip);
    if (Object.keys(patch).length) plan.updates.push({ id: current.id, sourceEventId: event.sourceEventId, patch });
    else plan.unchanged.push(current.id);
  }

  for (const e of existing) {
    if (!e.source_event_id || seenIds.has(e.source_event_id)) continue;
    if (new Date(e.starts_at).getTime() <= now.getTime()) continue; // past events are expected to drop off
    flag(e, "missing");
  }
  return plan;
}
