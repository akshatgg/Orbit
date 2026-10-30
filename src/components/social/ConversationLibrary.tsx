"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ChatImage, Lightbox, PdfRow, safeHref } from "@/components/messages/ChatMedia";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatEventDate } from "@/lib/format";
import { loadMoreLibrary } from "@/lib/social/actions";
import { displayName } from "@/lib/social/format";
import type { LibraryItem, LibraryPage, LibraryTab } from "@/types/social";
import { SocialIcon } from "./icons";

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" });

const EMPTY: Record<LibraryTab, { title: string; body: string }> = {
  media: { title: "No photos yet", body: "Images sent in this chat show up here." },
  links: { title: "No links yet", body: "Links and events shared in this chat show up here." },
  docs: { title: "No documents yet", body: "PDFs sent in this chat show up here." },
};

/** Months in the order the items came (newest first). */
function byMonth(items: LibraryItem[]) {
  const months: { label: string; items: { item: LibraryItem; index: number }[] }[] = [];
  items.forEach((item, index) => {
    const label = monthFmt.format(new Date(item.created_at));
    if (months.at(-1)?.label !== label) months.push({ label, items: [] });
    months.at(-1)!.items.push({ item, index });
  });
  return months;
}

/**
 * A conversation's Media, Links or Docs: the first page from the server, then "Load more". Mounted
 * afresh for each tab and search (the page keys it on them).
 */
export function ConversationLibrary({ conversationId, tab, q, initial }: {
  conversationId: string;
  tab: LibraryTab;
  q?: string;
  initial: LibraryPage;
}) {
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next_cursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function more() {
    if (!next) return;
    startTransition(async () => {
      const result = await loadMoreLibrary(conversationId, tab, q, next).catch(() => ({ ok: false as const, error: "Couldn't load more" }));
      if (!result.ok) return setError(result.error);
      setError(null);
      setItems((list) => [...list, ...result.items.filter((i) => !list.some((x) => x.id === i.id))]);
      setNext(result.next_cursor);
    });
  }

  if (items.length === 0) {
    return (
      <div className="md:[&>div]:mx-0">
        <EmptyState title={q ? "Nothing matches" : EMPTY[tab].title}>{q ? "Try another search." : EMPTY[tab].body}</EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 md:px-0">
      {tab === "media" && <MediaGrid items={items} />}
      {tab === "links" && <ul className="glass divide-y divide-line overflow-hidden rounded-[22px]">{items.map((i) => <li key={i.id}><LinkRow item={i} /></li>)}</ul>}
      {tab === "docs" && (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id}>
              <PdfRow doc={{ url: i.url ?? "", name: i.name ?? null, bytes: i.bytes ?? null }} sub={i.sender ? displayName(i.sender) : undefined} />
            </li>
          ))}
        </ul>
      )}
      {(next || error) && (
        <div className="flex flex-col items-center gap-1 pt-1">
          {next && <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={more}>{pending ? "Loading…" : "Load more"}</Button>}
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        </div>
      )}
    </div>
  );
}

function MediaGrid({ items }: { items: LibraryItem[] }) {
  const months = useMemo(() => byMonth(items), [items]);
  const images = useMemo(() => items.map((i) => ({ url: i.url ?? "", name: i.name ?? null })), [items]);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      {months.map((month) => (
        <section key={month.label} aria-label={month.label} className="space-y-2">
          <h3 className="text-xs font-semibold text-muted">{month.label}</h3>
          <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5">
            {month.items.map(({ item, index }) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpen(index)}
                  aria-label={`Open image${item.name ? `: ${item.name}` : ""}`}
                  className="block aspect-square w-full overflow-hidden rounded-[10px] bg-ink/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {item.url && <ChatImage src={item.url} alt={item.name ?? ""} width={240} />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {open !== null && <Lightbox images={images} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function LinkRow({ item }: { item: LibraryItem }) {
  const row = "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.04]";
  if (item.type === "event") {
    const href = item.event ? `/events/${item.event.id}` : item.url?.startsWith("/events/") ? item.url : null;
    const title = item.event?.title ?? item.title ?? "Event";
    const body = (
      <>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <SocialIcon name="star" className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted">{item.event ? formatEventDate(item.event.starts_at) : "Event"}</span>
        </span>
      </>
    );
    return href ? <Link href={href} className={row}>{body}</Link> : <span className={row}>{body}</span>;
  }
  const href = safeHref(item.url);
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink/[0.07] text-muted">
        <SocialIcon name="link" className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title || item.url}</span>
        <span className="block truncate text-xs text-muted">{item.domain ?? item.url}</span>
      </span>
    </>
  );
  return href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={row}>{body}</a> : <span className={row}>{body}</span>;
}
