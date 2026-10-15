import type { RegistrationStatus } from "@/types/database";
import type { Guest } from "./types";

export type GuestFilter = RegistrationStatus | "all" | "checked_in";

/** Case- and accent-insensitive match on name or email. */
export function matchesQuery(guest: Pick<Guest, "name" | "email">, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return fold(guest.name ?? "").includes(q) || fold(guest.email ?? "").includes(q);
}

export function filterGuests<T extends Pick<Guest, "name" | "email" | "status" | "checkedInAt">>(
  guests: T[],
  { status = "all", query = "" }: { status?: GuestFilter; query?: string },
): T[] {
  return guests.filter((g) => {
    if (status === "checked_in" ? !(g.status === "going" && g.checkedInAt) : status !== "all" && g.status !== status) {
      return false;
    }
    return matchesQuery(g, query);
  });
}

function fold(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
