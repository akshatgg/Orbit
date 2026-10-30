"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/tickets/Sheet";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { createCircleQuick, shareEvent } from "@/lib/social/actions";
import type { ShareableGroup } from "@/types/social";
import { SocialIcon } from "./icons";

/**
 * The share sheet (lazy-loaded by ShareToGroupButton, so cards carry no fetch or extra JS): the circles,
 * and communities that take shares, this person can post the event to — already-shared ones ticked —
 * with an optional note and a quick "Create a circle".
 */
export function ShareSheet({ eventId, eventTitle, open, onClose }: {
  eventId: string;
  eventTitle: string;
  open: boolean;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<ShareableGroup[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Mounted afresh for every opening (see ShareToGroupButton), so ticks reflect shares made elsewhere.
  useEffect(() => {
    let live = true;
    fetch(`/api/social/shareable?event_id=${encodeURIComponent(eventId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { items?: ShareableGroup[]; error?: string } | null;
        if (!response.ok || !data?.items) throw new Error(data?.error ?? "Couldn't load your circles");
        if (live) setGroups(data.items);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : "Couldn't load your circles");
        setGroups([]);
      });
    return () => {
      live = false;
    };
  }, [eventId]);

  function toggle(id: string) {
    setDone(null);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function create() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createCircleQuick(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setNewName("");
      setGroups((g) => [{ id: result.group.id, kind: "circle", name: result.group.name, member_count: 1, already_shared: false }, ...(g ?? [])]);
      setSelected((s) => new Set(s).add(result.group.id));
    });
  }

  function share() {
    const ids = [...selected];
    if (!ids.length) return;
    startTransition(async () => {
      const result = await shareEvent(eventId, ids, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const taken = new Set(result.items.filter((i) => i.status === "shared" || i.status === "already_shared").map((i) => i.group_id));
      const refused = result.items.find((i) => !taken.has(i.group_id));
      setError(refused?.error ?? null);
      setDone(result.message ?? "Shared");
      setGroups((g) => g?.map((x) => (taken.has(x.id) ? { ...x, already_shared: true } : x)) ?? null);
      setSelected(new Set());
      setNote("");
    });
  }

  const circles = groups?.filter((g) => g.kind === "circle") ?? [];
  const communities = groups?.filter((g) => g.kind !== "circle") ?? [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Share with a Circle</h2>
          <p className="mt-0.5 truncate text-sm text-muted">{eventTitle}</p>
        </div>
      }
    >
      <div className="space-y-5 pb-6" onClick={(e) => e.stopPropagation()}>
        {groups === null ? (
          <ul aria-busy="true" aria-label="Loading" className="space-y-2">
            {[0, 1, 2].map((i) => <li key={i} className="shimmer h-14 rounded-[18px]" />)}
          </ul>
        ) : (
          <>
            <section aria-labelledby="share-circles" className="space-y-2">
              <h3 id="share-circles" className="text-xs font-medium text-muted">Your circles</h3>
              {circles.length === 0 && <p className="text-sm text-muted">No circles yet. Start one below and share this with your friends.</p>}
              <GroupChoices groups={circles} selected={selected} onToggle={toggle} />
              <div className="flex gap-2 pt-1">
                <label htmlFor={`new-circle-${eventId}`} className="sr-only">New circle name</label>
                <input
                  id={`new-circle-${eventId}`}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      create();
                    }
                  }}
                  maxLength={60}
                  placeholder="Create a circle, e.g. Flatmates"
                  className={`${inputClass} py-2.5`}
                />
                <Button type="button" variant="secondary" onClick={create} disabled={pending || newName.trim().length < 2} className="shrink-0">
                  <SocialIcon name="plus" className="h-4 w-4" /> Create
                </Button>
              </div>
            </section>

            {communities.length > 0 && (
              <section aria-labelledby="share-communities" className="space-y-2">
                <h3 id="share-communities" className="text-xs font-medium text-muted">Share with a community or channel</h3>
                <GroupChoices groups={communities} selected={selected} onToggle={toggle} />
              </section>
            )}

            <div className="space-y-1.5">
              <label htmlFor={`share-note-${eventId}`} className="text-xs font-medium text-muted">Note (optional)</label>
              <textarea
                id={`share-note-${eventId}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Who's coming? Meet at 6?"
                className={`${inputClass} min-h-0 resize-none`}
              />
            </div>
          </>
        )}

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {done && <p role="status" className="text-sm text-emerald-300">{done}</p>}

        <Button type="button" full size="lg" onClick={share} disabled={pending || selected.size === 0}>
          {pending ? "Sharing…" : selected.size > 1 ? `Share with ${selected.size} groups` : "Share"}
        </Button>
      </div>
    </Sheet>
  );
}

/** Rows to tick, one per group: an already-shared one stays ticked and can't be changed. */
export function GroupChoices({ groups, selected, onToggle }: { groups: ShareableGroup[]; selected: Set<string>; onToggle: (id: string) => void }) {
  if (!groups.length) return null;
  return (
    <ul className="space-y-2">
      {groups.map((g) => {
        const on = g.already_shared || selected.has(g.id);
        return (
          <li key={g.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={g.already_shared}
              onClick={() => onToggle(g.id)}
              className={`flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${
                on ? "border-accent/40 bg-accent/[0.08]" : "border-ink/10 bg-ink/[0.04] hover:bg-ink/[0.08]"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-ink/[0.07] text-muted">
                <SocialIcon name={g.kind === "circle" ? "circles" : "community"} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{g.name}</span>
                {g.already_shared ? (
                  <span className="block text-xs text-muted">Already shared here</span>
                ) : g.member_count !== undefined ? (
                  <span className="block truncate text-xs text-muted">
                    {g.parent_name && <>{g.parent_name} · </>}{g.member_count} member{g.member_count === 1 ? "" : "s"}
                  </span>
                ) : g.parent_name ? (
                  <span className="block truncate text-xs text-muted">{g.parent_name}</span>
                ) : null}
              </span>
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? "border-transparent bg-accent text-white" : "border-ink/25"}`}
              >
                {on && <SocialIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
