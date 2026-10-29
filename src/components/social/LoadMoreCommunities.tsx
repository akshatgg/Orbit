"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { loadMoreCommunities } from "@/lib/social/feed-actions";
import type { ListView } from "@/lib/social/view";

/** "Load more" under the directory: appends the next page as cards or rows (`view`). Render inside the <ul>. */
export function LoadMoreCommunities({ filters, cursor, view = "grid" }: {
  filters: { category?: string; university?: string; q?: string };
  cursor: string | null;
  view?: ListView;
}) {
  const [pages, setPages] = useState<ReactNode[]>([]);
  const [next, setNext] = useState(cursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      {pages}
      {(next || error) && (
        <li className={`flex flex-col items-center gap-1 ${view === "list" ? "py-3" : "pt-1 md:col-span-2 lg:col-span-3"}`}>
          {next && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await loadMoreCommunities(filters, next, view);
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
