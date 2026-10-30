import Form from "next/form";
import { inputClass } from "@/components/ui/Field";
import { getLibrary } from "@/lib/social/queries";
import type { LibraryTab } from "@/types/social";
import { ConversationLibrary } from "./ConversationLibrary";
import { SocialIcon } from "./icons";
import { SegmentLinks } from "./SocialTabs";

const TABS: { value: LibraryTab; label: string }[] = [
  { value: "media", label: "Media" },
  { value: "links", label: "Links" },
  { value: "docs", label: "Docs" },
];

export function libraryTab(value: string | string[] | undefined): LibraryTab {
  return value === "links" || value === "docs" ? value : "media";
}

export function libraryQuery(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() ? v.trim().slice(0, 100) : undefined;
}

/**
 * Media / Links / Docs with a search box, for a channel's info page and a circle's or DM's library
 * page. The tab and the search live in the URL at `basePath`. Call inside a <Suspense> boundary.
 */
export async function LibraryPanel({ conversationId, basePath, tab, q }: { conversationId: string; basePath: string; tab: LibraryTab; q?: string }) {
  const page = await getLibrary(conversationId, tab, { q });
  const search = q ? `q=${encodeURIComponent(q)}` : "";
  const href = (t: LibraryTab) => {
    const query = [t === "media" ? "" : `tab=${t}`, search].filter(Boolean).join("&");
    return query ? `${basePath}?${query}` : basePath;
  };
  return (
    <section aria-label="Media, links and docs" className="space-y-3">
      {/* Full width on the shared `mx-4`, so the tabs line up with the search and list below. */}
      <div className="md:[&>nav]:mx-0 md:[&>nav]:max-w-none">
        <SegmentLinks label="Media, links and docs" items={TABS.map((t) => ({ href: href(t.value), label: t.label, active: t.value === tab }))} />
      </div>
      <Form action={basePath} replace scroll={false} role="search" className="relative mx-4 md:mx-0">
        {tab !== "media" && <input type="hidden" name="tab" value={tab} />}
        <label>
          <span className="sr-only">Search {tab}</span>
          <SocialIcon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          {/* Keyed on the search, so moving through the URL updates the box. */}
          <input key={q ?? ""} name="q" type="search" defaultValue={q} maxLength={100} placeholder={`Search ${tab}`} className={`${inputClass} py-2.5 pl-10`} />
        </label>
      </Form>
      {page ? (
        <ConversationLibrary key={`${tab}:${q ?? ""}`} conversationId={conversationId} tab={tab} q={q} initial={page} />
      ) : (
        <p className="px-4 text-sm text-muted md:px-0">This isn&apos;t available right now.</p>
      )}
    </section>
  );
}
