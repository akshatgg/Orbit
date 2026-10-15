// Client-safe helpers about event capacity (no server imports).

export type EventCounts = { going: number; waitlisted: number; pending: number };

/** Spots left for capped events, or null when unlimited / not using ORBIT tickets. */
export function spotsLeft(
  event: { capacity: number | null; registration_mode: string },
  counts: EventCounts,
) {
  if (event.registration_mode !== "tickets" || event.capacity === null) return null;
  return Math.max(0, event.capacity - counts.going - counts.pending);
}
