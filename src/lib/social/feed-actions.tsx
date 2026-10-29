"use server";

import type { ReactNode } from "react";
import { z } from "zod";
import { CommunityCard } from "@/components/social/CommunityCard";
import { GroupEventCard } from "@/components/social/GroupEventCard";
import { getCurrentUser } from "@/lib/auth";
import { getMyEventState } from "@/lib/events/queries";
import { getGroup, listCommunities, listGroupEvents } from "./queries";

const ref = z.string().trim().min(1).max(120).regex(/^[\w-]+$/);
const cursorSchema = z.string().min(1).max(500).regex(/^[\w=+/-]+$/);

export type MoreEvents = { ok: true; nodes: ReactNode; nextCursor: string | null } | { ok: false; error: string };

/**
 * The next page of a circle's or community's events, rendered on the server (the same cards as the
 * first page) and appended by <LoadMoreEvents>.
 */
export async function loadMoreGroupEvents(groupRef: string, when: "upcoming" | "past", cursor: string): Promise<MoreEvents> {
  if (!ref.safeParse(groupRef).success || !cursorSchema.safeParse(cursor).success || !["upcoming", "past"].includes(when)) {
    return { ok: false, error: "Couldn't load more" };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };
  const [group, page] = await Promise.all([getGroup(groupRef), listGroupEvents(groupRef, when, { cursor })]);
  if (!group) return { ok: false, error: "Couldn't load more" };
  const community = group.kind === "community";
  const state = community ? await getMyEventState(user.id, page.items.map((i) => i.event.id)) : null;
  const canModerate = group.my_role === "admin";

  return {
    ok: true,
    nextCursor: page.nextCursor,
    nodes: page.items.map((item) => (
      <li key={item.event.id}>
        <GroupEventCard
          item={item}
          groupId={group.id}
          kind={group.kind}
          viewerId={user.id}
          canModerate={canModerate}
          saved={state ? state.saved.has(item.event.id) : undefined}
          past={when === "past"}
        />
      </li>
    )),
  };
}

const filterSchema = z.object({
  category: z.string().max(80).optional(),
  university: z.string().max(120).optional(),
  q: z.string().max(80).optional(),
});

/** The next page of the communities directory, as cards (appended by <LoadMoreCommunities>). */
export async function loadMoreCommunities(filters: { category?: string; university?: string; q?: string }, cursor: string): Promise<MoreEvents> {
  const parsed = filterSchema.safeParse(filters);
  if (!parsed.success || !cursorSchema.safeParse(cursor).success) return { ok: false, error: "Couldn't load more" };
  const page = await listCommunities(parsed.data, { cursor });
  return {
    ok: true,
    nextCursor: page.nextCursor,
    nodes: page.items.map((c) => <li key={c.id}><CommunityCard community={c} /></li>),
  };
}
