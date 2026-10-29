import type { Metadata } from "next";
import { Suspense } from "react";
import { CommunityCard, CommunityRow } from "@/components/social/CommunityCard";
import { DirectoryFilters } from "@/components/social/DirectoryFilters";
import { ViewList, ViewProvider } from "@/components/social/ListView";
import { LoadMoreCommunities } from "@/components/social/LoadMoreCommunities";
import { DirectorySkeleton } from "@/components/social/Skeletons";
import { SocialTabs } from "@/components/social/SocialTabs";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/lib/auth";
import { groupCategories } from "@/lib/social/format";
import { getListView, listCommunities, type DirectoryFilters as Filters } from "@/lib/social/queries";

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
  const [params, view] = await Promise.all([searchParams, getListView("communities"), requireProfile()]);
  const filters: Filters = { category: one(params.category), university: one(params.university), q: one(params.q) };
  const filtered = !!(filters.category || filters.university || filters.q);

  // The page, and (in parallel) the whole directory's categories and universities for the filters.
  const [page, all] = await Promise.all([
    listCommunities(filters),
    listCommunities({}, { limit: 50 }),
  ]);

  // Every category any community covers (a community can have several); the API matches
  // `?category=` against any of them.
  const categories = [...new Map(all.items.flatMap(groupCategories).map((c) => [c.slug ?? c.id, c.name])).entries()]
    .filter(([key]) => key)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const universities = [...new Set(all.items.map((c) => c.university).filter((u): u is string => !!u))].sort();
  const Item = view === "list" ? CommunityRow : CommunityCard;

  return (
    <ViewProvider scope="communities" view={view}>
      <div className="space-y-4">
        <DirectoryFilters category={filters.category} university={filters.university} q={filters.q} categories={categories} universities={universities} />

        {page.items.length === 0 ? (
          <EmptyState
            title={filtered ? "No communities match" : "No communities yet"}
            action={filtered ? <ButtonLink href="/communities" variant="secondary" size="sm">Clear filters</ButtonLink> : undefined}
          >
            {filtered ? "Try another search, category or university." : "ORBIT's communities will appear here soon."}
          </EmptyState>
        ) : (
          <ViewList
            aria-label="Communities"
            className={view === "list"
              ? "glass mx-4 divide-y divide-line overflow-hidden rounded-[22px]"
              : "space-y-3 px-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3"}
          >
            {page.items.map((c) => <li key={c.id}><Item community={c} /></li>)}
            {/* Keyed on the layout: pages loaded before a switch start over in the new one. */}
            <LoadMoreCommunities key={view} filters={filters} cursor={page.nextCursor} view={view} />
          </ViewList>
        )}
      </div>
    </ViewProvider>
  );
}
