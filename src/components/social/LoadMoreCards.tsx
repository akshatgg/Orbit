"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { MoreEvents } from "@/lib/social/feed-actions";
import type { ListView } from "@/lib/social/view";

/**
 * "Load more" under the directory or a community's channels: appends the next page as cards or rows
 * (`view`). `load` is the page's server action bound to its filters. Render inside the <ul>.
 */
export function LoadMoreCards({ load, cursor, view = "grid", gridSpan = "md:col-span-2 lg:col-span-3" }: {
  load: (cursor: string) => Promise<MoreEvents>;
  cursor: string | null;
  view?: ListView;
  /** Grid view: classes that take the button across the list's columns. */
  gridSpan?: string;
}) {
  const [pages, setPages] = useState<ReactNode[]>([]);
  const [next, setNext] = useState(cursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      {pages}
      {(next || error) && (
        <li className={`flex flex-col items-center gap-1 ${view === "list" ? "py-3" : `pt-1 ${gridSpan}`}`}>
          {next && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await load(next);
                  if (!result.ok) return setError(result.error);
                  setError(null);
                  setPages((p) => [...p, result.nodes]);
                  setNext(result.nextCursor);
                })
              }
            >
              {pending ? "Loading…" : "Load more"}
            </Button>
          )}
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        </li>
      )}
    </>
  );
}
