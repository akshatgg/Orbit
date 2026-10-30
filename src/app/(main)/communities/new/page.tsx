import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/nav/BackLink";
import { CreateCommunityForm } from "@/components/social/CreateCommunityForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/lib/auth";
import { listCategories } from "@/lib/events/queries";
import { getCreatableOrganisers } from "@/lib/social/queries";
import { NewCommunitySkeleton } from "./loading";

export const metadata: Metadata = { title: "New community" };

export default function NewCommunityPage({ searchParams }: PageProps<"/communities/new">) {
  return (
    <div className="mx-auto w-full max-w-2xl pb-8">
      <PageHeader
        title="New community"
        subtitle="A home for your members: announcements, and channels people join for what they care about."
        back={<BackLink href="/communities" label="Communities" />}
      />
      <Suspense fallback={<NewCommunitySkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/communities/new">["searchParams"] }) {
  const [params, creatable, categories] = await Promise.all([searchParams, getCreatableOrganisers(), listCategories(), requireProfile()]);
  const organisations = creatable.items.filter((o) => o.can_create);
  const organiser = Array.isArray(params.organiser) ? params.organiser[0] : params.organiser;

  if (!creatable.is_orbit_admin && organisations.length === 0) {
    const full = creatable.items.find((o) => o.status === "approved");
    return (
      <EmptyState
        title={full ? "Your organisation has all its communities" : "Communities are run by organisations"}
        action={full
          ? <ButtonLink href={`/communities/${full.communities[0]?.slug ?? ""}`} variant="secondary" size="sm">Go to your community</ButtonLink>
          : <ButtonLink href={creatable.items.length ? "/organiser" : "/organiser/apply"} variant="secondary" size="sm">{creatable.items.length ? "Open Studio" : "Become an organiser"}</ButtonLink>}
      >
        {full
          ? `An organisation can run up to ${creatable.limit} communities. Add channels to one you already have instead.`
          : creatable.items.length
            ? "Once ORBIT approves your organisation, its team can create a community here."
            : "An approved organisation's owners and editors can create one for it."}
      </EmptyState>
    );
  }

  return (
    <div className="px-4">
      <CreateCommunityForm
        organisations={organisations}
        orbitAdmin={creatable.is_orbit_admin}
        initialOrganiser={organiser}
        categories={categories.filter((c) => c.slug).map((c) => ({ value: c.slug!, label: c.name }))}
      />
    </div>
  );
}
