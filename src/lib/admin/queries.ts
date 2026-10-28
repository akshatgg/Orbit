import "server-only";
import type { Organiser, Profile } from "@/types/database";
import { authed } from "@/lib/api/session";

export type PersonLite = Pick<Profile, "id" | "full_name" | "email" | "avatar_url">;

export function personName(p: Pick<PersonLite, "full_name" | "email"> | undefined | null) {
  return p?.full_name || p?.email || "Unknown";
}

/** One row of `GET /admin/organisers`. */
export type AdminOrganiser = Pick<
  Organiser,
  | "id" | "slug" | "name" | "kind" | "logo_url" | "bio" | "website" | "contact_email" | "university"
  | "status" | "is_verified" | "review_note" | "reviewed_by" | "reviewed_at" | "created_at"
> & {
  event_count: number;
  member_count: number;
  /** Owners' names, comma-separated. */
  owner_names: string;
  /** Present once the API includes it. */
  stripe_charges_enabled?: boolean;
};

type Page<T> = { items: T[]; total: number; page: number; page_size: number };

/** Every organiser (any status) with its event and member counts. Small table — filtered in memory. */
export async function listOrganisersWithCounts(): Promise<AdminOrganiser[]> {
  const page = await authed.get<Page<AdminOrganiser>>("/admin/organisers");
  return page.items;
}

export type MemberRow = {
  user_id: string;
  role: "owner" | "editor";
  created_at: string;
  full_name: string | null;
  email: string | null;
};

/** Team members per organiser (`GET /admin/organisers/{id}/members`), earliest first. */
export async function membersFor(organiserIds: string[]) {
  const entries = await Promise.all(
    organiserIds.map(async (id) => [id, await authed.get<MemberRow[]>(`/admin/organisers/${id}/members`)] as const),
  );
  return new Map<string, MemberRow[]>(entries);
}
