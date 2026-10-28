import "server-only";
import { cache } from "react";
import type { Category, OrbitEvent, Organiser } from "@/types/database";
import { api } from "@/lib/api/client";
import { isApiStatus, isNotFound } from "@/lib/api/errors";
import { apiAs, authed, sessionToken } from "@/lib/api/session";
import { listCategories, type EventCardData, type EventCounts, type EventWithCounts } from "@/lib/events/queries";

// Organiser Studio and public organiser page reads, all from the Orbit API.

type Paged<T> = { items: T[]; total: number; page: number; page_size: number };

/** An event row as the studio and organiser endpoints return it (money as decimal strings). */
type EventRow = Omit<OrbitEvent, "price_min" | "price_max"> & {
  price_min: number | string | null;
  price_max: number | string | null;
  counts?: EventCounts;
};

type CardOrganiser = Pick<Organiser, "id" | "slug" | "name" | "logo_url" | "is_verified" | "kind">;

const EMPTY_COUNTS: EventCounts = { going: 0, waitlisted: 0, pending: 0 };

const money = (value: number | string | null) => (value === null || value === undefined ? null : Number(value));

/** Studio / organiser rows → the card shape every event list renders. */
function toCards(rows: EventRow[], organiser: CardOrganiser | null, categories: Category[]): EventWithCounts[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return rows.map((row) => {
    const category = row.category_id ? byId.get(row.category_id) : undefined;
    const card: EventCardData = {
      ...row,
      price_min: money(row.price_min),
      price_max: money(row.price_max),
      organiser,
      category: category ? { id: category.id, slug: category.slug, name: category.name, group: category.group } : null,
    };
    return { ...card, counts: row.counts ?? EMPTY_COUNTS };
  });
}

function cardOrganiser(org: Organiser | CardOrganiser): CardOrganiser {
  return { id: org.id, slug: org.slug, name: org.name, logo_url: org.logo_url, is_verified: org.is_verified, kind: org.kind };
}

/** Every page of a paged list (the API caps a page at 100 rows). */
async function allPages<T>(fetchPage: (page: number) => Promise<Paged<T>>, limit: number) {
  const items: T[] = [];
  for (let page = 1; items.length < limit; page += 1) {
    const result = await fetchPage(page);
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) break;
  }
  return items.slice(0, limit);
}

/** Every event of an organiser the signed-in member can see (drafts included), with counts. */
export async function listOrganiserEvents(organiserId: string, organiser?: CardOrganiser | null) {
  const [page, categories] = await Promise.all([
    authed.get<Paged<EventRow>>("/organiser/events", { query: { organiser_id: organiserId, page_size: 500 } }),
    listCategories(),
  ]);
  return toCards(page.items, organiser ? cardOrganiser(organiser) : null, categories);
}

/** Followers of an organiser (members only: the studio overview). */
export async function getFollowerCount(organiserId: string) {
  const overview = await authed.get<{ followers: number }>("/organiser/overview", { query: { organiser_id: organiserId } });
  return overview.followers ?? 0;
}

/** Whether the signed-in user follows the organiser (false when signed out). */
export async function isFollowing(userId: string | null | undefined, organiserId: string) {
  if (!userId) return false;
  const following = await apiAs<{ items: { id: string }[] }>("/me/following");
  return Boolean(following?.items.some((o) => o.id === organiserId));
}

type OrganiserPage = { organiser: Organiser; follower_count: number; following: boolean };

/**
 * The public organiser page's header data, deduplicated per request. Approved organisers are public;
 * the API also returns a pending one to its own members. Null when unknown or hidden.
 */
export const getOrganiserPage = cache(async (slug: string): Promise<OrganiserPage | null> => {
  const token = await sessionToken();
  try {
    return await api.get<OrganiserPage>(`/organisers/${encodeURIComponent(slug)}`, { token: token ?? undefined });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
});

export async function getOrganiserBySlug(slug: string) {
  return (await getOrganiserPage(slug))?.organiser ?? null;
}

/** Public events (published / cancelled / expired) for the organiser page. */
export async function listPublicOrganiserEvents(organiser: Organiser | CardOrganiser) {
  const [rows, categories] = await Promise.all([
    allPages(
      (page) => api.get<Paged<EventRow>>(`/organisers/${organiser.id}/events`, { query: { when: "all", page, page_size: 100 } }),
      200,
    ),
    listCategories(),
  ]);
  return toCards(rows, cardOrganiser(organiser), categories);
}

export type TeamMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: "owner" | "editor";
  created_at: string;
};

export async function listTeam(organiserId: string) {
  const page = await authed.get<Paged<TeamMember>>(`/organisers/${organiserId}/team`, { query: { page_size: 100 } });
  return page.items;
}

export type TeamInvite = {
  id: string;
  code: string;
  role: string;
  expires_at: string;
  max_uses: number;
  uses: number;
  revoked: boolean;
  created_at: string;
};

/** Invite links of an organisation (owners and admins only), newest first. */
export async function listInvites(organiserId: string) {
  const page = await authed.get<Paged<TeamInvite>>(`/organisers/${organiserId}/invites`, { query: { page_size: 20 } });
  return page.items;
}

type EditorDetail = {
  event: OrbitEvent;
  organiser: { id: string; name: string; slug: string } | null;
  private: { online_url: string | null; guest_info: string | null } | null;
  ticket_types: { id: string; name: string; price: number | string; quantity: number | null; sales_end_at: string | null }[];
  questions: { id: string; label: string; kind: string; options: string[] | null; required: boolean }[];
  counts: EventCounts;
  registration_total: number;
  series: { id: string; status: string }[];
};

/** Everything the editor needs for one event. Null when it doesn't exist or isn't the caller's to manage. */
export async function getEventForEdit(eventId: string) {
  let detail: EditorDetail;
  try {
    detail = await authed.get<EditorDetail>(`/organiser/events/${eventId}`);
  } catch (error) {
    if (isApiStatus(error, 403, 404, 422)) return null;
    throw error;
  }
  const event = { ...detail.event, price_min: money(detail.event.price_min) };
  return {
    event,
    organiser: detail.organiser,
    private: detail.private,
    tickets: detail.ticket_types,
    questions: detail.questions,
    registrations: detail.registration_total,
    /** How many dates the event's series has (1 for a one-off); removed dates don't count. */
    seriesDates: 1 + detail.series.filter((s) => s.status !== "removed").length,
  };
}
