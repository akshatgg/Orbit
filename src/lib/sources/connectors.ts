import "server-only";
import { fetchFeedText } from "./fetch";
import { parseIcal } from "./ical";
import { cleanEvent } from "./platforms";
import type { SourceConnector, SourceKind } from "./types";

/** iCal feeds, with the platform's own clean-up for Luma / Meetup. */
function feedConnector(kind: SourceKind): SourceConnector {
  return {
    kind,
    async fetchEvents(source, { now }) {
      const text = await fetchFeedText(source.url);
      const result = parseIcal(text, { now });
      return { ...result, events: result.events.map((e) => cleanEvent(kind, e)) };
    },
  };
}

/** Add new kinds here (official APIs etc.) — the sync engine only sees NormalizedEvent[]. */
export const CONNECTORS: Record<SourceKind, SourceConnector> = {
  ical: feedConnector("ical"),
  luma: feedConnector("luma"),
  meetup: feedConnector("meetup"),
};
