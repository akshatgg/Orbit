"use client";

import { useEffect, useState, useTransition } from "react";
import { GroupChoices } from "@/components/social/ShareSheet";
import { Sheet } from "@/components/tickets/Sheet";
import { Button } from "@/components/ui/Button";
import { shareEvent } from "@/lib/social/actions";
import type { ShareableGroup, ShareOutcome } from "@/types/social";

/**
 * The channels of an organisation's communities, ticked to share one event there: grouped by
 * community, Announcements ticked to start with, channels it's already in ticked and fixed. Shares
 * in one call and says which channels couldn't take it.
 */
export function CommunityChannelPicker({ eventId, organiserId }: { eventId: string; organiserId: string }) {
  const [channels, setChannels] = useState<ShareableGroup[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [refused, setRefused] = useState<ShareOutcome[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({ event_id: eventId, organiser_id: organiserId });
    fetch(`/api/social/shareable?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { items?: ShareableGroup[]; error?: string } | null;
        if (!response.ok || !data?.items) throw new Error(data?.error ?? "Couldn't load your channels");
        if (!live) return;
        setChannels(data.items);
        setSelected(new Set(data.items.filter((c) => c.is_announcements && !c.already_shared).map((c) => c.id)));
      })
      .catch((e: unknown) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Couldn't load your channels");
        setChannels([]);
      });
    return () => {
      live = false;
    };
  }, [eventId, organiserId]);

  function toggle(id: string) {
    setDone(null);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function share() {
    const ids = [...selected];
    if (!ids.length) return;
    startTransition(async () => {
      const result = await shareEvent(eventId, ids);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const taken = new Set(result.items.filter((i) => i.status === "shared" || i.status === "already_shared").map((i) => i.group_id));
      setError(null);
      setRefused(result.items.filter((i) => !taken.has(i.group_id)));
      setDone(result.message ?? "Shared");
      setChannels((c) => c?.map((x) => (taken.has(x.id) ? { ...x, already_shared: true } : x)) ?? null);
      setSelected(new Set());
    });
  }

  // One section per community, in the order the API sorts them (Announcements first in each).
  const communities = [...new Map((channels ?? []).map((c) => [c.parent_id ?? c.id, c.parent_name ?? c.name])).entries()];
  const names = new Map((channels ?? []).map((c) => [c.id, c.parent_name ? `${c.parent_name} · ${c.name}` : c.name]));

  if (channels === null) {
    return (
      <ul aria-busy="true" aria-label="Loading" className="space-y-2">
        {[0, 1, 2].map((i) => <li key={i} className="shimmer h-14 rounded-[18px]" />)}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      {channels.length === 0 && !error && (
        <p className="text-sm text-muted">Your communities have no channels you can share to.</p>
      )}
      {communities.map(([id, name]) => (
        <section key={id} aria-label={name} className="space-y-2">
          {communities.length > 1 && <h3 className="text-xs font-medium text-muted">{name}</h3>}
          <GroupChoices groups={channels.filter((c) => (c.parent_id ?? c.id) === id)} selected={selected} onToggle={toggle} />
        </section>
      ))}

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {done && <p role="status" className="text-sm text-emerald-300">{done}</p>}
      {refused.length > 0 && (
        <ul className="space-y-1 text-xs text-muted">
          {refused.map((r) => (
            <li key={r.group_id}>
              <span className="font-medium text-fg/90">{names.get(r.group_id) ?? r.name ?? "A channel"}</span>: {r.error ?? "couldn't take it"}
            </li>
          ))}
        </ul>
      )}

      {channels.length > 0 && (
        <Button type="button" full onClick={share} disabled={pending || selected.size === 0}>
          {pending ? "Sharing…" : selected.size > 1 ? `Share in ${selected.size} channels` : "Share"}
        </Button>
      )}
    </div>
  );
}

/**
 * Right after an event goes live: "Share this event in your community?" — No thanks, or Yes for the
 * channel picker. An event that isn't live yet can't be shared, so it only says so.
 */
export function ShareToCommunityStep({ eventId, organiserId, live }: { eventId: string; organiserId: string; live: boolean }) {
  const [answer, setAnswer] = useState<"ask" | "yes" | "no">("ask");
  if (answer === "no") return null;
  return (
    <section aria-labelledby="share-step" className="glass space-y-3 rounded-[22px] p-4">
      <div>
        <h2 id="share-step" className="text-[15px] font-semibold tracking-tight">Share this event in your community?</h2>
        <p className="mt-0.5 text-sm text-muted">
          {live ? "Post it in your community's channels so members see it in their chats." : "You can share it in your community once it's live."}
        </p>
      </div>
      {live && answer === "ask" && (
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setAnswer("no")}>No thanks</Button>
          <Button type="button" size="sm" onClick={() => setAnswer("yes")}>Yes, pick channels</Button>
        </div>
      )}
      {live && answer === "yes" && <CommunityChannelPicker eventId={eventId} organiserId={organiserId} />}
    </section>
  );
}

/** "Share to community" on an event's Studio page: the channel picker in a sheet, for any time later. */
export function ShareToCommunityButton({ eventId, organiserId, eventTitle, className }: {
  eventId: string;
  organiserId: string;
  eventTitle: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className={className}>Share to community</Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">Share to your community</h2>
            <p className="mt-0.5 truncate text-sm text-muted">{eventTitle}</p>
          </div>
        }
      >
        {/* Mounted afresh for every opening, so ticks reflect shares made elsewhere. */}
        <div className="pb-6">{open && <CommunityChannelPicker eventId={eventId} organiserId={organiserId} />}</div>
      </Sheet>
    </>
  );
}
