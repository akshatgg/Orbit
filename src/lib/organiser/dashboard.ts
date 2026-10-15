// Pure helpers for the organiser dashboard and public organiser page.

type OrgLike = { id: string; status: string };

/** The organiser a studio page works on: `?org=` if the user may use it, else the first approved one. */
export function pickOrganiser<T extends OrgLike>(orgs: T[], orgParam: string | string[] | undefined, approvedOnly = true) {
  const usable = approvedOnly ? orgs.filter((o) => o.status === "approved") : orgs;
  const wanted = Array.isArray(orgParam) ? orgParam[0] : orgParam;
  return usable.find((o) => o.id === wanted) ?? usable[0] ?? null;
}

type EventLike = { status: string; starts_at: string; ends_at: string | null };

export type EventGroups<T> = { drafts: T[]; upcoming: T[]; past: T[]; cancelled: T[] };

export const hasEnded = (e: Pick<EventLike, "starts_at" | "ends_at">, now = new Date()) =>
  new Date(e.ends_at ?? e.starts_at).getTime() < now.getTime();

/** Drafts / Upcoming (soonest first) / Past (latest first) / Cancelled & removed. */
export function groupOrganiserEvents<T extends EventLike>(events: T[], now = new Date()): EventGroups<T> {
  const groups: EventGroups<T> = { drafts: [], upcoming: [], past: [], cancelled: [] };
  for (const e of events) {
    if (e.status === "draft") groups.drafts.push(e);
    else if (e.status === "cancelled" || e.status === "removed") groups.cancelled.push(e);
    else if (e.status === "expired" || hasEnded(e, now)) groups.past.push(e);
    else groups.upcoming.push(e);
  }
  const t = (e: T) => new Date(e.starts_at).getTime();
  groups.drafts.sort((a, b) => t(a) - t(b));
  groups.upcoming.sort((a, b) => t(a) - t(b));
  groups.past.sort((a, b) => t(b) - t(a));
  groups.cancelled.sort((a, b) => t(b) - t(a));
  return groups;
}

/** Total registrations across events (going + awaiting approval/payment + waitlisted). */
export function totalRegistrations(counts: { going: number; pending: number; waitlisted: number }[]) {
  return counts.reduce((sum, c) => sum + c.going + c.pending + c.waitlisted, 0);
}
