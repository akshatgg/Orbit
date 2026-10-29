"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { loadMoreGroupEvents } from "@/lib/social/feed-actions";
import type { ListView } from "@/lib/social/view";

/**
 * "Load more" under a group's event list: appends the next server-rendered page, as cards or (a
 * community's list view) rows. Render inside the <ul>.
 */
export function LoadMoreEvents({ groupRef, when = "upcoming", cursor, view = "grid" }: {
  groupRef: string;
  when?: "upcoming" | "past";
  cursor: string | null;
  view?: ListView;
}) {
  const [pages, setPages] = useState<ReactNode[]>([]);
  const [next, setNext] = useState(cursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function more() {
    if (!next) return;
    startTransition(async () => {
      const result = await loadMoreGroupEvents(groupRef, when, next, view);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setPages((p) => [...p, result.nodes]);
      setNext(result.nextCursor);
    });
  }

  return (
    <>
      {pages}
      {(next || error) && (
        <li className={`flex flex-col items-center gap-1 ${view === "list" ? "py-3" : "pt-1 md:col-span-2"}`}>
          {next && (
            <Button type="button" variant="secondary" size="sm" onClick={more} disabled={pending}>
              {pending ? "Loading…" : "Load more"}
            </Button>
          )}
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        </li>
      )}
    </>
  );
}
