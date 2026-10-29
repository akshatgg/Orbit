"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { deleteAnnouncement, editAnnouncement } from "@/lib/social/actions";
import { displayName, timeAgo } from "@/lib/social/format";
import type { Announcement } from "@/types/social";

type Mode = "view" | "edit" | "confirm";

const MAX = 1000;

/**
 * One announcement. Its author (and moderators, for delete) get a small "⋯" menu: Edit rewrites it in
 * place (Save / Cancel, optimistic, rolled back if the API refuses), Delete asks inline and removes the
 * card optimistically. Shows "edited" when it has been changed.
 */
export function AnnouncementCard({ groupId, announcement }: { groupId: string; announcement: Announcement }) {
  const [current, setCurrent] = useState(announcement);
  const [mode, setMode] = useState<Mode>("view");
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(announcement.body);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const menu = useRef<HTMLDivElement>(null);

  const canEdit = !!current.can_edit;
  const canDelete = !!current.can_delete;
  const event = current.event ?? (current.event_id ? { id: current.event_id, title: current.event_title ?? "See the event" } : null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const onPointer = (e: MouseEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [menuOpen]);

  if (removed) return null;

  function startEdit() {
    setMenuOpen(false);
    setError(null);
    setDraft(current.body);
    setMode("edit");
  }

  function save() {
    const body = draft.trim();
    if (!body || body === current.body) {
      setMode("view");
      return;
    }
    const before = current;
    setCurrent({ ...current, body, edited_at: new Date().toISOString() });
    setMode("view");
    setError(null);
    startTransition(async () => {
      const result = await editAnnouncement(groupId, current.id, body);
      if (!result.ok) {
        setCurrent(before);
        setError(result.error);
        return;
      }
      if (result.announcement) setCurrent((c) => ({ ...c, ...result.announcement }));
    });
  }

  function remove() {
    setRemoved(true);
    startTransition(async () => {
      const result = await deleteAnnouncement(groupId, current.id);
      if (!result.ok) {
        setRemoved(false);
        setMode("view");
        setError(result.error);
      }
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setMode("view");
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    }
  }

  return (
    <li className="glass rounded-[20px] p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1zm12-1.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" />
        </svg>
        <span className="truncate font-medium text-fg">{displayName(current.author, "Organisers")}</span>
        <span className="shrink-0">
          · {timeAgo(current.created_at)}
          {current.edited_at && <span title={`Edited ${new Date(current.edited_at).toLocaleString("en-GB")}`}> · edited</span>}
        </span>
        {(canEdit || canDelete) && mode === "view" && (
          <div ref={menu} className="relative ml-auto">
            <button
              type="button"
              aria-label="Announcement options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="-my-1 flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/[0.08] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-8 z-20 w-36 overflow-hidden rounded-2xl border border-line bg-raised p-1 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.5)]">
                {canEdit && (
                  <button type="button" role="menuitem" onClick={startEdit} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-fg hover:bg-ink/[0.08]">
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setError(null);
                      setMode("confirm");
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {mode === "edit" ? (
        <div className="mt-2 space-y-2">
          <label htmlFor={`edit-${current.id}`} className="sr-only">Announcement</label>
          <textarea
            id={`edit-${current.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX}
            rows={3}
            autoFocus
            className="w-full resize-y rounded-[14px] border border-ink/10 bg-ink/[0.045] px-3 py-2 text-sm leading-relaxed text-fg outline-none focus:border-accent/60 focus:ring-4 focus:ring-accent/15 light:border-line light:bg-surface"
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setMode("view")} className="h-8 rounded-full px-3.5 text-xs font-semibold text-muted hover:bg-ink/[0.06] hover:text-fg">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={!draft.trim()} className="bg-gradient h-8 rounded-full px-3.5 text-xs font-semibold text-bg transition active:scale-[0.97] disabled:opacity-40">
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className={`mt-2 whitespace-pre-line text-sm leading-relaxed ${pending ? "opacity-70" : ""}`}>{current.body}</p>
      )}

      {mode === "confirm" && (
        <div role="alertdialog" aria-label="Delete announcement" className="mt-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-red-400/20 bg-red-500/[0.06] px-3 py-2 text-sm">
          <span className="mr-auto text-fg/90">Delete this announcement?</span>
          <button type="button" onClick={() => setMode("view")} className="h-8 rounded-full px-3 text-xs font-semibold text-muted hover:text-fg">
            Cancel
          </button>
          <button type="button" onClick={remove} className="h-8 rounded-full border border-red-400/25 bg-red-500/10 px-3 text-xs font-semibold text-red-200 hover:bg-red-500/20">
            Delete
          </button>
        </div>
      )}

      {event && mode !== "edit" && (
        <Link href={`/events/${event.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          {event.title}
          <svg aria-hidden viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </Link>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </li>
  );
}
