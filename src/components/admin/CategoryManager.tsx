"use client";

import { useActionState, useEffect } from "react";
import { Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { deleteCategory, saveCategory, type CategoryFormState } from "@/app/admin/categories/actions";
import { ActionButton } from "./ActionButton";
import { IconTrash } from "./icons";
import { toast } from "./Toaster";

export type CategoryRow = { id: string; slug: string; name: string; group: string; sort_order: number; event_count: number };

const GROUPS = [["career", "Career"], ["social", "Social"], ["other", "Other"]] as const;

function CategoryFields({ row, state, idp }: { row?: CategoryRow; state: CategoryFormState; idp: string }) {
  const fe = state?.fieldErrors ?? {};
  const v = state?.values;
  const val = (k: keyof CategoryRow, fallback: string | number | undefined) => (v ? v[k] ?? "" : fallback);
  const cls = (k: string) => (fe[k] ? "border-red-400" : "");
  return (
    <>
      <div>
        <label htmlFor={`${idp}-name`} className="sr-only">Name</label>
        <Input id={`${idp}-name`} name="name" placeholder="Name" defaultValue={val("name", row?.name)} required className={cls("name")} />
        {fe.name && <p className="mt-1 text-xs text-red-300">{fe.name}</p>}
      </div>
      <div>
        <label htmlFor={`${idp}-slug`} className="sr-only">Slug</label>
        <Input id={`${idp}-slug`} name="slug" placeholder="slug (auto)" defaultValue={val("slug", row?.slug)} className={cls("slug")} />
        {fe.slug && <p className="mt-1 text-xs text-red-300">{fe.slug}</p>}
      </div>
      <div>
        <label htmlFor={`${idp}-group`} className="sr-only">Group</label>
        <Select id={`${idp}-group`} name="group" defaultValue={val("group", row?.group ?? "career")}>
          {GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      <div>
        <label htmlFor={`${idp}-sort`} className="sr-only">Sort order</label>
        <Input id={`${idp}-sort`} name="sort_order" type="number" step={1} placeholder="Order" defaultValue={val("sort_order", row?.sort_order ?? 0)} className={cls("sort_order")} />
        {fe.sort_order && <p className="mt-1 text-xs text-red-300">{fe.sort_order}</p>}
      </div>
    </>
  );
}

const grid = "grid gap-2 sm:grid-cols-[1.4fr_1.2fr_8rem_6rem_auto] sm:items-start";

export function AddCategoryForm() {
  const [state, action] = useActionState(saveCategory.bind(null, null), null);
  useEffect(() => {
    if (state?.ok) toast(state.message ?? "Added");
  }, [state]);
  return (
    <form action={action} className={`${grid} p-4`}>
      <CategoryFields state={state} idp="new-cat" />
      <SubmitButton pendingText="Adding…">Add</SubmitButton>
      {state?.error && !state.fieldErrors && <p role="alert" className="text-sm text-red-300 sm:col-span-5">{state.error}</p>}
      {state?.error && state.fieldErrors && <p role="alert" className="text-sm text-red-300 sm:col-span-5">{state.error}</p>}
    </form>
  );
}

export function CategoryEditRow({ row }: { row: CategoryRow }) {
  const [state, action] = useActionState(saveCategory.bind(null, row.id), null);
  useEffect(() => {
    if (state?.ok) toast(state.message ?? "Saved");
  }, [state]);
  return (
    <li className="px-4 py-3">
      <form action={action} className={grid}>
        <CategoryFields row={row} state={state} idp={`cat-${row.id}`} />
        <div className="flex items-center gap-2">
          <SubmitButton variant="secondary" size="sm" pendingText="Saving…">Save</SubmitButton>
          <ActionButton
            action={() => deleteCategory(row.id)}
            variant="danger"
            label={`Delete ${row.name}`}
            confirm={{
              title: `Delete ${row.name}?`,
              body: row.event_count
                ? `${row.event_count} event${row.event_count === 1 ? " uses" : "s use"} this category, so it can't be deleted yet.`
                : "This can't be undone.",
              confirmLabel: "Delete category",
              danger: true,
            }}
          >
            <IconTrash size={14} />
          </ActionButton>
        </div>
      </form>
      <p className="mt-1 text-xs text-muted">{row.event_count} event{row.event_count === 1 ? "" : "s"}</p>
      {state?.error && <p role="alert" className="mt-1 text-sm text-red-300">{state.error}</p>}
    </li>
  );
}
