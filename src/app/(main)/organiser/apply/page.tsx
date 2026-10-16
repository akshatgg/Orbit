import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/nav/BackLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApplyForm } from "@/components/organiser/ApplyForm";
import { getMyOrganisers, getProfile, requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Become an organiser" };

const STEPS = [
  { title: "Apply", body: "Tell us who you are. It takes two minutes." },
  { title: "We review", body: "The ORBIT team checks every organiser once — usually within a day or two." },
  { title: "Publish", body: "Once approved, your events go live straight away. No review per event." },
];

export default function ApplyPage() {
  return (
    <>
      <PageHeader
        back={<BackLink href="/organiser" label="Studio" />}
        title="Become an organiser"
        subtitle="Societies, university teams, employers and communities publish events on ORBIT."
      />
      <div className="space-y-6 px-4">
        <ol className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="glass rounded-[20px] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <span className="bg-gradient inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-bg">{i + 1}</span>
                {s.title}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <Card className="rounded-[24px] p-5">
          <Suspense fallback={<FormSkeleton />}>
            <Form />
          </Suspense>
        </Card>
      </div>
    </>
  );
}

async function Form() {
  const user = await requireUser();
  const [profile, orgs] = await Promise.all([getProfile(), getMyOrganisers()]);
  const pending = orgs.filter((o) => o.status === "pending");
  return (
    <>
      {pending.length > 0 && (
        <p className="mb-5 rounded-2xl border border-orange/25 bg-orange/10 px-4 py-3 text-sm text-orange">
          {pending.map((o) => o.name).join(", ")} {pending.length === 1 ? "is" : "are"} already waiting for approval. You
          can still apply for another organiser.
        </p>
      )}
      <ApplyForm defaultEmail={user.email ?? ""} defaultUniversity={profile?.university ?? ""} />
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11" />
        </div>
      ))}
    </div>
  );
}
