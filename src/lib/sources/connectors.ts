import "server-only";
import { fetchFeedText } from "./fetch";
import { parseIcal } from "./ical";
import type { SourceConnector, SourceKind } from "./types";

/** iCal / ICS feeds the owner has given us permission to use. */
export const icalConnector: SourceConnector = {
  kind: "ical",
  async fetchEvents(source, { now }) {
    const text = await fetchFeedText(source.url);
    return parseIcal(text, { now });
  },
};

/** Add new kinds here (official APIs etc.) — the sync engine only sees NormalizedEvent[]. */
export const CONNECTORS: Record<SourceKind, SourceConnector> = {
  ical: icalConnector,
};
