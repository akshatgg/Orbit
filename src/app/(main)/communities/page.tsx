import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CommunityCard } from "@/components/social/CommunityCard";
import { DirectoryFilters } from "@/components/social/DirectoryFilters";
import { LoadMoreCommunities } from "@/components/social/LoadMoreCommunities";
import { DirectorySkeleton } from "@/components/social/Skeletons";
import { SocialTabs } from "@/components/social/SocialTabs";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/lib/auth";
import { listCommunities, type DirectoryFilters as Filters } from "@/lib/social/queries";

export const metadata: Metadata = { title: "Communities" };

const SUBTITLE = "Interest groups across ORBIT: join one to see its events and announcements.";

export default function CommunitiesPage({ searchParams }: PageProps<"/communities">) {
  return (
    <>
      <PageHeader title="Communities" subtitle={SUBTITLE} />
      <SocialTabs />
      <Suspense fallback={<DirectorySkeleton />}>
        <Directory searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function one(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() ? v.trim().slice(0, 120) : undefined;
}

async function Directory({ searchParams }: { searchParams: PageProps<"/communities">["searchParams"] }) {
  const [params] = await Promise.all([searchParams, requireProfile()]);
  const filters: Filters = { category: one(params.category), university: one(params.university), q: one(params.q) };
  const filtered = !!(filters.category || filters.university || filters.q);

  // The page, and (in parallel) the whole directory's categories and universities for the filters.
  const [page, all] = await Promise.all([
    listCommunities(filters),
    listCommunities({}, { limit: 50 }),
  ]);

  const categories = [...new Map(all.items.filter((c) => c.category_name).map((c) => [c.category_slug ?? c.category_id ?? "", c.category_name!])).entries()]
    .filter(([key]) => key)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const universities = [...new Set(all.items.map((c) => c.university).filter((u): u is string => !!u))].sort();
  const href = (category?: string) => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (filters.university) qs.set("university", filters.university);
    if (filters.q) qs.set("q", filters.q);
    const s = qs.toString();
    return s ? `/communities?${s}` : "/communities";
  };

  return (
    <div className="space-y-4">
      {categories.length > 0 && (
        <nav aria-label="Categories" className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-1">
          {[["", "All"] as [string, string], ...categories].map(([key, label]) => {
            const active = (filters.category ?? "") === key;
            return (
              <Link
                key={key || "all"}
                href={href(key || undefined)}
                replace
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition duration-200 ${
                  active ? "bg-gradient border-transparent font-medium text-bg" : "border-ink/10 bg-ink/[0.045] text-muted hover:border-ink/20 hover:text-fg"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
      {(universities.length > 0 || all.items.length > 8) && (
        <DirectoryFilters category={filters.category} university={filters.university} q={filters.q} universities={universities} />
      )}

      {page.items.length === 0 ? (
        <EmptyState
          title={filtered ? "No communities match" : "No communities yet"}
          action={filtered ? <ButtonLink href="/communities" variant="secondary" size="sm">Clear filters</ButtonLink> : undefined}
        >
          {filtered ? "Try another category or university." : "ORBIT's communities will appear here soon."}
        </EmptyState>
      ) : (
        <ul className="space-y-3 px-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
          {page.items.map((c) => <li key={c.id}><CommunityCard community={c} /></li>)}
          <LoadMoreCommunities filters={filters} cursor={page.nextCursor} />
        </ul>
      )}
    </div>
  );
}
