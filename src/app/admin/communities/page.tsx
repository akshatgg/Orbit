import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { CommunityForm } from "@/components/admin/CommunityForm";
import { AdminHeader, Empty, Panel, TableSkeleton, table } from "@/components/admin/primitives";
import { Toaster } from "@/components/admin/Toaster";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { listCategories } from "@/lib/events/queries";
import { groupCategories } from "@/lib/social/format";
import { listCommunities } from "@/lib/social/queries";

export const metadata: Metadata = { title: "Communities · Admin" };

const VISIBILITY: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  public: { label: "Open", tone: "success" },
  approval: { label: "Approval", tone: "warning" },
  private: { label: "Private", tone: "neutral" },
};

export default function Page() {
  return (
    <>
      <AdminHeader eyebrow="Social" title="Communities" subtitle="Interest groups students can join. Each one's feed shows its shared events plus upcoming events in its categories." />
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <Content />
      </Suspense>
      <Toaster />
    </>
  );
}

async function Content() {
  await requireAdmin();
  const [{ items, total }, categories] = await Promise.all([listCommunities({}, { limit: 50 }), listCategories()]);

  return (
    <div className="space-y-6">
      <Panel title={`All communities (${total})`}>
        {items.length === 0 ? (
          <div className="p-5"><Empty title="No communities yet">Create the first one below.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Name</th>
                  <th className={table.th}>Categories</th>
                  <th className={table.th}>University</th>
                  <th className={table.th}>Joining</th>
                  <th className={table.th}>Members</th>
                  <th className={table.th}>Upcoming</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const vis = VISIBILITY[c.visibility] ?? VISIBILITY.public;
                  return (
                    <tr key={c.id} className={table.tr}>
                      <td className={table.td}>
                        <Link href={`/admin/communities/${c.id}`} className="font-medium text-fg hover:text-accent">{c.name}</Link>
                        <span className="block text-xs text-subtle">/communities/{c.slug ?? c.id}</span>
                      </td>
                      <td className={table.td}>
                        {groupCategories(c).map((cat) => cat.name).join(", ") || <span className="text-subtle">—</span>}
                      </td>
                      <td className={table.td}>{c.university ?? <span className="text-subtle">Any</span>}</td>
                      <td className={table.td}><Badge tone={vis.tone}>{vis.label}</Badge></td>
                      <td className={table.td}>{c.member_count}</td>
                      <td className={table.td}>{c.upcoming_event_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="New community">
        <CommunityForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      </Panel>
    </div>
  );
}
