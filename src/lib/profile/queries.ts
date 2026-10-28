import "server-only";
import { cache } from "react";
import type { Organiser, RegistrationStatus } from "@/types/database";
import { api, ApiError } from "@/lib/api/client";
import { apiAs } from "@/lib/api/session";
import { listCategories, type EventCardData, type EventWithCounts } from "@/lib/events/queries";

export type ProfileEvent = EventCardData & {
  saved: boolean;
  attended: boolean;
  registration?: RegistrationStatus;
};

type MyEventCard = EventWithCounts & {
  saved: boolean;
  attended: boolean;
  external_registered: boolean;
  registration: RegistrationStatus | null;
};

/** Registrations that mean "I was on the list" for the Past events section. */
const ATTENDING: RegistrationStatus[] = ["going"];

function toProfileEvent({ saved, attended, registration, ...event }: MyEventCard): ProfileEvent {
  return {
    ...event,
    saved,
    attended,
    registration: registration && ATTENDING.includes(registration) ? registration : undefined,
  };
}

/**
 * The signed-in user's saved / registered / attended events, split into upcoming saved events
 * (soonest first) and ended events (most recent first). Deduplicated per request so the Saved
 * and Past sections share one read.
 */
export const getMyEventLists = cache(async () => {
  const [upcoming, ended] = await Promise.all([
    apiAs<{ items: MyEventCard[] }>("/me/events", { query: { when: "upcoming" } }),
    apiAs<{ items: MyEventCard[] }>("/me/events", { query: { when: "past" } }),
  ]);

  const saved = (upcoming?.items ?? []).filter((e) => e.saved).map(toProfileEvent);
  // Saved, externally registered, "I went" and confirmed-ticket events all belong in the history.
  const past = (ended?.items ?? [])
    .filter((e) => e.saved || e.attended || e.external_registered || (e.registration && ATTENDING.includes(e.registration)))
    .map(toProfileEvent);

  return { saved, past };
});

export type FollowedOrganiser = Pick<Organiser, "id" | "slug" | "name" | "logo_url" | "is_verified" | "kind" | "bio">;

type FollowingRow = Pick<Organiser, "id" | "slug" | "name" | "logo_url" | "is_verified"> &
  Partial<Pick<Organiser, "kind" | "bio">>;

/** Organisers the user follows. */
export async function getFollowedOrganisers(): Promise<FollowedOrganiser[]> {
  const following = await apiAs<{ items: FollowingRow[] }>("/me/following");
  const rows = following?.items ?? [];
  // The list carries no kind / bio; the organiser page does (a short list, read in parallel).
  return Promise.all(
    rows.map(async (row) => {
      if (row.kind !== undefined && row.bio !== undefined) return row as FollowedOrganiser;
      try {
        const { organiser } = await api.get<{ organiser: FollowedOrganiser }>(`/organisers/${encodeURIComponent(row.slug)}`);
        return { ...row, kind: organiser.kind, bio: organiser.bio };
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        return { ...row, kind: row.kind ?? "other", bio: row.bio ?? null };
      }
    }),
  );
}

/** Category slug → name, for the interests summary. */
export async function getCategoryNames() {
  const categories = await listCategories();
  return new Map(categories.map((c) => [c.slug, c.name]));
}
