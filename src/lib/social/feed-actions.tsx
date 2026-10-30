"use server";

import type { ReactNode } from "react";
import { z } from "zod";
import { ChannelItem, ChannelRow } from "@/components/social/ChannelCard";
import { CommunityCard, CommunityRow } from "@/components/social/CommunityCard";
import { GroupEventCard, GroupEventRow } from "@/components/social/GroupEventCard";
import { getCurrentUser } from "@/lib/auth";
import { getMyEventState } from "@/lib/events/queries";
import { getGroup, listChannels, listCommunities, listGroupEvents } from "./queries";
import { parseView, type ListView } from "./view";

const ref = z.string().trim().min(1).max(120).regex(/^[\w-]+$/);
const cursorSchema = z.string().min(1).max(500).regex(/^[\w=+/-]+$/);

export type MoreEvents = { ok: true; nodes: ReactNode; nextCursor: string | null } | { ok: false; error: string };

/**
 * The next page of a circle's or community's events, rendered on the server (the same cards, or a
 * community's list rows, as the first page) and appended by <LoadMoreEvents>.
 */
export async function loadMoreGroupEvents(groupRef: string, when: "upcoming" | "past", cursor: string, view: ListView = "grid"): Promise<MoreEvents> {
  if (!ref.safeParse(groupRef).success || !cursorSchema.safeParse(cursor).success || !["upcoming", "past"].includes(when)) {
    return { ok: false, error: "Couldn't load more" };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };
  const [group, page] = await Promise.all([getGroup(groupRef), listGroupEvents(groupRef, when, { cursor })]);
  if (!group) return { ok: false, error: "Couldn't load more" };
  const community = group.kind !== "circle";
  const state = community ? await getMyEventState(user.id, page.items.map((i) => i.event.id)) : null;
  const canModerate = group.can_manage ?? group.my_role === "admin";
  const Item = community && parseView(view) === "list" ? GroupEventRow : GroupEventCard;

  return {
    ok: true,
    nextCursor: page.nextCursor,
    nodes: page.items.map((item) => (
      <li key={item.event.id}>
        <Item
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

/** The next page of a community's channels, as cards or rows (appended by <LoadMoreCommunities>). */
export async function loadMoreChannels(community: string, filters: { category?: string; q?: string }, view: ListView, cursor: string): Promise<MoreEvents> {
  const parsed = filterSchema.safeParse(filters);
  if (!ref.safeParse(community).success || !parsed.success || !cursorSchema.safeParse(cursor).success) return { ok: false, error: "Couldn't load more" };
  const page = await listChannels(community, parsed.data, { cursor });
  const Item = parseView(view) === "list" ? ChannelRow : ChannelItem;
  return {
    ok: true,
    nextCursor: page.nextCursor,
    nodes: page.items.map((c) => <li key={c.id}><Item channel={c} /></li>),
  };
}

/** The next page of the communities directory, as cards or rows (appended by <LoadMoreCommunities>). */
export async function loadMoreCommunities(filters: { category?: string; university?: string; q?: string }, view: ListView, cursor: string): Promise<MoreEvents> {
  const parsed = filterSchema.safeParse(filters);
  if (!parsed.success || !cursorSchema.safeParse(cursor).success) return { ok: false, error: "Couldn't load more" };
  const page = await listCommunities(parsed.data, { cursor });
  const Item = parseView(view) === "list" ? CommunityRow : CommunityCard;
  return {
    ok: true,
    nextCursor: page.nextCursor,
    nodes: page.items.map((c) => <li key={c.id}><Item community={c} /></li>),
  };
}
