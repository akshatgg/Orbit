"use server";

import { z } from "zod";
import { categorySchema } from "@/lib/admin/category";
import { adminContext, adminError, revalidateEverywhere, type ActionResult } from "@/lib/admin/server";
import { apiErrorCode, isConflict } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";

export type CategoryFormState = { ok?: boolean; error?: string; fieldErrors?: Partial<Record<string, string>>; message?: string; values?: Record<string, string> } | null;

/** Create (categoryId null) or update a category. Bound with the id, used with useActionState. */
export async function saveCategory(categoryId: string | null, _prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  await adminContext();
  const raw = Object.fromEntries(formData);
  if (!raw.slug && raw.name) raw.slug = raw.name;
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Check the highlighted fields", fieldErrors: fe, values: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)])) };
  }
  if (categoryId && !z.uuid().safeParse(categoryId).success) return { error: "Invalid category" };
  try {
    if (categoryId) await authed.patch(`/admin/categories/${categoryId}`, { body: await changedFields(categoryId, parsed.data) });
    else await authed.post("/admin/categories", { body: parsed.data });
  } catch (error) {
    return { error: isConflict(error) ? "That slug is already used" : adminError(error) };
  }
  revalidateEverywhere();
  return { ok: true, message: categoryId ? "Saved" : "Category added" };
}

/**
 * The update body without an unchanged `group`: the API only needs what changed, and
 * leaving the group out keeps name/slug/keyword edits working on every API version.
 */
async function changedFields<T extends { group?: string }>(categoryId: string, data: T): Promise<Partial<T>> {
  const { items } = await authed.get<{ items: { id: string; group: string }[] }>("/admin/categories");
  const current = items.find((c) => c.id === categoryId);
  if (!current || current.group !== data.group) return data;
  const { group: _unchanged, ...rest } = data;
  void _unchanged;
  return rest as Partial<T>;
}

/** Refuses to delete a category that events still use. */
export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  await adminContext();
  if (!z.uuid().safeParse(categoryId).success) return { ok: false, error: "Invalid category" };
  try {
    const { items } = await authed.get<{ items: { id: string; name: string; event_count: number }[] }>("/admin/categories");
    const cat = items.find((c) => c.id === categoryId);
    if (!cat) return { ok: false, error: "Category not found" };
    const count = cat.event_count;
    if (count) return { ok: false, error: `${count} event${count === 1 ? " uses" : "s use"} this category. Move ${count === 1 ? "it" : "them"} to another category first.` };
    await authed.del(`/admin/categories/${categoryId}`);
    revalidateEverywhere();
    return { ok: true, message: `Deleted ${cat.name}` };
  } catch (error) {
    // Events were added to it since the page loaded: the API says how many.
    if (isConflict(error)) return { ok: false, error: `${apiErrorCode(error)}. Move them to another category first.` };
    return { ok: false, error: adminError(error) };
  }
}
