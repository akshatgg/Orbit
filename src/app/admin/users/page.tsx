import { Suspense } from "react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { inputClass } from "@/components/ui/Field";
import { AddAdminForm } from "@/components/admin/AddAdminForm";
import { IconSearch } from "@/components/admin/icons";
import { AdminHeader, Empty, Pagination, Panel, TableSkeleton, hrefWith, table } from "@/components/admin/primitives";
import { Toaster } from "@/components/admin/Toaster";
import { RemoveAdminButton, VerifyStudentButton } from "@/components/admin/UserActions";
import { isSuperAdmin, requireAdmin } from "@/lib/auth";
import { sanitiseSearch } from "@/lib/admin/labels";
import { USER_TYPE_FILTERS, describeUser, parseTypeFilter, typeFilterClause } from "@/lib/admin/users";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const metadata: Metadata = { title: "Users · Admin" };

const PAGE_SIZE = 25;
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const COLS = "id, email, full_name, avatar_url, university, course, role, is_verified_student, onboarded_at, created_at, user_type, goals";
type Row = Pick<Profile, "id" | "email" | "full_name" | "avatar_url" | "university" | "course" | "role" | "is_verified_student" | "onboarded_at" | "created_at" | "user_type" | "goals">;

export default function Page({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <AdminHeader eyebrow="People" title="Users & admins" subtitle="Everyone on ORBIT. Verify students, see who can administer the platform." />
      <Suspense fallback={<TableSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
      <Toaster />
    </>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  const me = await requireAdmin();
  const superAdmin = isSuperAdmin(me);
  const sp = await searchParams;
  const q = sanitiseSearch(typeof sp.q === "string" ? sp.q : "");
  const only = sp.only === "unverified" ? "unverified" : sp.only === "verified" ? "verified" : "";
  const type = parseTypeFilter(sp.type);
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "", 10) || 1);
  const supabase = await createClient();

  let query = supabase.from("profiles").select(COLS, { count: "exact" });
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,university.ilike.%${q}%,course.ilike.%${q}%`);
  if (only) query = query.eq("is_verified_student", only === "verified");
  const typeClause = typeFilterClause(type);
  if (typeClause) query = query.or(typeClause);
  if (type === "host") query = query.contains("goals", ["host"]);
  query = query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [{ data, count, error }, { data: admins }] = await Promise.all([
    query,
    supabase.from("profiles").select(COLS).in("role", ["admin", "super_admin"]).order("role", { ascending: false }).order("created_at"),
  ]);
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const adminRows = (admins ?? []) as Row[];
  const total = count ?? 0;

  return (
    <div className="space-y-8">
      <Panel title="Admins">
        <ul className="divide-y divide-line/60">
          {adminRows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar src={a.avatar_url} name={a.full_name ?? a.email} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.full_name ?? a.email}</span>
                <span className="block truncate text-xs text-muted">{a.email}</span>
              </span>
              <Badge tone={a.role === "super_admin" ? "brand" : "info"}>{a.role === "super_admin" ? "Super admin" : "Admin"}</Badge>
              {superAdmin && a.role === "admin" && a.email && <RemoveAdminButton email={a.email} />}
            </li>
          ))}
        </ul>
        <div className="border-t border-line p-4">
          {superAdmin ? (
            <>
              <h3 className="mb-2 text-sm font-medium">Add admin by email</h3>
              <AddAdminForm />
            </>
          ) : (
            <p className="text-sm text-muted">Only the super admin can add or remove admins. You have read-only access to this list.</p>
          )}
        </div>
      </Panel>

      <section aria-label="All users">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Form action="/admin/users" className="relative min-w-56 flex-1">
            {only && <input type="hidden" name="only" value={only} />}
            {type && <input type="hidden" name="type" value={type} />}
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <label htmlFor="user-q" className="sr-only">Search users</label>
            <input id="user-q" name="q" defaultValue={q} placeholder="Search name, email, university, course" className={`${inputClass} py-2 pl-9`} />
          </Form>
          <nav aria-label="Filter" className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
            {([["", "All"], ["verified", "Verified"], ["unverified", "Not verified"]] as const).map(([v, label]) => (
              <Link key={v} href={hrefWith("/admin/users", { q, only: v, type })} aria-current={only === v ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 ${only === v ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}>
                {label}
              </Link>
            ))}
          </nav>
          <nav aria-label="User type" className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
            {USER_TYPE_FILTERS.map((f) => (
              <Link key={f.value} href={hrefWith("/admin/users", { q, only, type: f.value })} aria-current={type === f.value ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 ${type === f.value ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}>
                {f.label}
              </Link>
            ))}
          </nav>
        </div>

        {rows.length === 0 ? (
          <Empty title="No users found">{q ? "Try a different search." : "Nobody has signed up yet."}</Empty>
        ) : (
          <>
            <div className={table.wrap}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th className={table.th}>User</th>
                    <th className={table.th}>Type</th>
                    <th className={table.th}>Goals</th>
                    <th className={table.th}>University / course</th>
                    <th className={table.th}>Role</th>
                    <th className={table.th}>Onboarded</th>
                    <th className={table.th}>Joined</th>
                    <th className={table.th}>Student</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className={table.tr}>
                      <td className={table.td}>
                        <span className="flex items-center gap-3">
                          <Avatar src={u.avatar_url} name={u.full_name ?? u.email} size={32} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{u.full_name ?? "—"}</span>
                            <span className="block truncate text-xs text-muted">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <TypeCells user={u} />
                      <td className={`${table.td} text-muted`}>
                        {[u.university, u.course].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className={table.td}>
                        {u.role === "user" ? <span className="text-muted">User</span> : <Badge tone={u.role === "super_admin" ? "brand" : "info"}>{u.role === "super_admin" ? "Super admin" : "Admin"}</Badge>}
                      </td>
                      <td className={table.td}>{u.onboarded_at ? <Badge tone="success">Yes</Badge> : <span className="text-muted">No</span>}</td>
                      <td className={`${table.td} whitespace-nowrap text-muted tabular-nums`}>{dateFmt.format(new Date(u.created_at))}</td>
                      <td className={table.td}>
                        <span className="flex items-center gap-2">
                          {u.is_verified_student && <Badge tone="info">✓ Verified</Badge>}
                          <VerifyStudentButton userId={u.id} verified={u.is_verified_student} name={u.full_name ?? u.email ?? "user"} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} total={total} noun="user"
              hrefFor={(p) => hrefWith("/admin/users", { q, only, type, page: p })} />
          </>
        )}
      </section>
    </div>
  );
}

function TypeCells({ user }: { user: Row }) {
  const d = describeUser(user);
  return (
    <>
      <td className={`${table.td} whitespace-nowrap`}>
        {user.onboarded_at || user.user_type ? d.typeLabel : <span className="text-muted">—</span>}
      </td>
      <td className={table.td}>
        <span className="flex flex-wrap items-center gap-1">
          {d.isHost && <Badge tone="brand">Host</Badge>}
          {d.goalLabels.map((g) => <Badge key={g}>{g}</Badge>)}
          {!d.goalLabels.length && !d.isHost && <span className="text-muted">—</span>}
        </span>
      </td>
    </>
  );
}
