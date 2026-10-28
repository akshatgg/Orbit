"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { markAllNotificationsRead, markNotificationRead, respondInvite } from "@/lib/social/actions";
import { timeAgo } from "@/lib/social/format";
import type { InboxItem } from "@/types/social";
import { refreshBadges, setBadge } from "./badges";
import { SocialIcon, type SocialIconName } from "./icons";

type Page = { items: InboxItem[]; unread_count: number; pending_invite_ids: string[]; has_more?: boolean };
type Answer = "accepted" | "declined";

const PAGE = 20;

const KIND_ICON: Record<string, SocialIconName> = {
  circle_invite: "circles",
  join_request: "community",
  request_approved: "check",
  event_shared: "shareGroup",
  announcement: "megaphone",
};

async function fetchPage(before?: string): Promise<Page> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  const response = await fetch(`/api/social/notifications${qs}`, { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.includes("json")) throw new Error(String(response.status));
  return (await response.json()) as Page;
}

/**
 * The bell's content (lazy-loaded by NotificationBell): the latest notifications, older ones a page at
 * a time, mark read / read all, and Accept / Decline on invites that are still waiting for an answer.
 */
export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [waiting, setWaiting] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [pending, startTransition] = useTransition();

  const apply = useCallback((page: Page, append: boolean) => {
    setItems((prev) => (append && prev ? [...prev, ...page.items.filter((i) => !prev.some((p) => p.id === i.id))] : page.items));
    setWaiting((prev) => new Set([...(append ? prev : []), ...page.pending_invite_ids]));
    setUnread(page.unread_count);
    setBadge("notifications", page.unread_count);
    setHasMore(page.has_more ?? page.items.length >= PAGE);
  }, []);

  useEffect(() => {
    let live = true;
    fetchPage()
      .then((page) => live && apply(page, false))
      .catch(() => live && (setError("Couldn't load notifications"), setItems([])));
    return () => {
      live = false;
    };
  }, [apply]);

  async function more() {
    const last = items?.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      apply(await fetchPage(last.created_at), true);
    } catch {
      setError("Couldn't load more");
    } finally {
      setLoadingMore(false);
    }
  }

  function markRead(item: InboxItem) {
    if (item.read_at) return;
    const now = new Date().toISOString();
    setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, read_at: now } : i)) ?? null);
    setUnread((n) => Math.max(0, n - 1));
    setBadge("notifications", unread - 1);
    startTransition(async () => {
      const result = await markNotificationRead(item.id);
      if (!result.ok) refreshBadges();
    });
  }

  function readAll() {
    const before = items;
    const now = new Date().toISOString();
    setItems((list) => list?.map((i) => ({ ...i, read_at: i.read_at ?? now })) ?? null);
    setUnread(0);
    setBadge("notifications", 0);
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setItems(before);
        setError(result.error);
      }
      refreshBadges();
    });
  }

  function answer(item: InboxItem, accept: boolean) {
    const { group_id: groupId, invite_id: inviteId } = item;
    if (!groupId || !inviteId) return;
    startTransition(async () => {
      const result = await respondInvite(groupId, inviteId, accept);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setAnswers((a) => ({ ...a, [item.id]: accept ? "accepted" : "declined" }));
      markRead(item);
      refreshBadges();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Notifications</h2>
        <button
          type="button"
          onClick={readAll}
          disabled={pending || unread === 0}
          className="text-xs font-medium text-accent transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>
      <div className="overflow-y-auto overscroll-contain">
        {error && <p role="alert" className="px-4 py-3 text-sm text-red-300">{error}</p>}
        {items === null && (
          <ul aria-busy="true" aria-label="Loading" className="space-y-3 p-4">
            {[0, 1, 2].map((i) => <li key={i} className="shimmer h-12 rounded-2xl" />)}
          </ul>
        )}
        {items && items.length === 0 && !error && (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-muted">Circle invites, join requests and shared events show up here.</p>
          </div>
        )}
        {items && items.length > 0 && (
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const answered = answers[item.id];
              const canAnswer = !answered && !!item.invite_id && !!item.group_id && waiting.has(item.invite_id);
              return (
                <li key={item.id} className={item.read_at ? "" : "bg-accent/[0.06]"}>
                  <Row item={item} onOpen={() => { markRead(item); onClose(); }} />
                  {canAnswer && (
                    <div className="flex gap-2 px-4 pb-3 pl-[3.75rem]">
                      <button type="button" disabled={pending} onClick={() => answer(item, true)} className="bg-gradient h-8 rounded-full px-3.5 text-xs font-semibold text-bg transition active:scale-[0.97] disabled:opacity-50">
                        Accept
                      </button>
                      <button type="button" disabled={pending} onClick={() => answer(item, false)} className="h-8 rounded-full border border-ink/10 bg-ink/[0.05] px-3.5 text-xs font-semibold text-fg transition hover:bg-ink/[0.1] active:scale-[0.97] disabled:opacity-50">
                        Decline
                      </button>
                    </div>
                  )}
                  {answered && (
                    <p className="px-4 pb-3 pl-[3.75rem] text-xs text-muted">
                      {answered === "accepted" ? (
                        <>
                          You&apos;re in.{" "}
                          <Link href={`/circles/${item.group_id}`} onClick={onClose} className="font-medium text-accent hover:underline">
                            Open the circle
                          </Link>
                        </>
                      ) : (
                        "Invite declined"
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && items && items.length > 0 && (
          <div className="border-t border-line p-2">
            <button type="button" onClick={more} disabled={loadingMore} className="w-full rounded-xl py-2 text-xs font-medium text-muted transition-colors hover:bg-ink/[0.05] hover:text-fg disabled:opacity-50">
              {loadingMore ? "Loading…" : "Show older"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ item, onOpen }: { item: InboxItem; onOpen: () => void }) {
  const body = (
    <>
      {item.actor ? (
        <Avatar src={item.actor.avatar_url} name={item.actor.full_name} size={34} />
      ) : (
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-ink/10 bg-ink/[0.06] text-muted">
          <SocialIcon name={KIND_ICON[item.kind] ?? "bell"} className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug">{item.title}</span>
        {item.body && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted">{item.body}</span>}
        <span className="mt-1 block text-[11px] text-subtle">{timeAgo(item.created_at)}</span>
      </span>
      {!item.read_at && <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />}
    </>
  );
  const cls = "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.05]";
  return item.link ? (
    <Link href={item.link} onClick={onOpen} className={cls}>{body}</Link>
  ) : (
    <button type="button" onClick={onOpen} className={cls}>{body}</button>
  );
}
