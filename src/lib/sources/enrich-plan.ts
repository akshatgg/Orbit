// Pure rules for reading Luma event pages: which events, when to stop, what to fill.

import type { LumaPageDetails } from "./luma-page";
import { lumaPageUrl } from "./platforms";
import type { SourceEventDetails } from "./types";

export const ENRICH_LIMIT = 25; // pages per source per run
export const MAX_ATTEMPTS = 3;
export const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
export const ENRICH_BUDGET_MS = 120_000; // per source, keeps the cron well under its 300 s limit
export const PAUSE_MS = 1000; // between page reads

export type EnrichCandidate = {
  id: string;
  source_event_id: string | null;
  external_url: string | null;
  starts_at: string;
  created_at: string;
  cover_url: string | null;
  description: string | null;
  price_min: number | null;
};

/** Upcoming Luma events never read, or failed ones due a retry; newest first. */
export function pickEventsToEnrich(
  events: EnrichCandidate[],
  details: Map<string, Pick<SourceEventDetails, "status" | "attempts" | "fetched_at">>,
  now: Date,
  limit = ENRICH_LIMIT,
): EnrichCandidate[] {
  return events
    .filter((e) => {
      if (!lumaPageUrl(e) || new Date(e.starts_at).getTime() <= now.getTime()) return false;
      const d = details.get(e.id);
      if (!d) return true;
      return d.status === "failed" && d.attempts < MAX_ATTEMPTS && now.getTime() - new Date(d.fetched_at).getTime() >= RETRY_AFTER_MS;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/** Luma is refusing or rate-limiting us: stop reading pages for this run. */
export const isBlockedStatus = (status: number) => status === 403 || status === 429 || status === 503;

export type DetailsPatch = { cover_url?: string; description?: string; price_min?: number; price_max?: number; currency?: string };

/** Only fills fields that are empty, so admin edits always win. */
export function detailsPatch(
  current: Pick<EnrichCandidate, "cover_url" | "description" | "price_min">,
  page: LumaPageDetails,
  importedCover: string | null,
): DetailsPatch {
  const patch: DetailsPatch = {};
  if (!current.cover_url && importedCover) patch.cover_url = importedCover;
  if (!current.description && page.description) patch.description = page.description;
  if (current.price_min === null && page.priceMin !== null && page.priceMax !== null && page.currency) {
    patch.price_min = page.priceMin;
    patch.price_max = page.priceMax;
    patch.currency = page.currency;
  }
  return patch;
}
