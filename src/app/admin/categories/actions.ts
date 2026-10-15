"use server";

import { categorySchema } from "@/lib/admin/category";
import { adminContext, friendlyDbError, logAdminAction, revalidateEverywhere, type ActionResult } from "@/lib/admin/server";
import { z } from "zod";

export type CategoryFormState = { ok?: boolean; error?: string; fieldErrors?: Partial<Record<string, string>>; message?: string; values?: Record<string, string> } | null;

/** Create (categoryId null) or update a category. Bound with the id, used with useActionState. */
export async function saveCategory(categoryId: string | null, _prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const { supabase } = await adminContext();
  const raw = Object.fromEntries(formData);
  if (!raw.slug && raw.name) raw.slug = raw.name;
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Check the highlighted fields", fieldErrors: fe, values: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)])) };
  }
  if (categoryId) {
    if (!z.uuid().safeParse(categoryId).success) return { error: "Invalid category" };
    const { error } = await supabase.from("categories").update(parsed.data).eq("id", categoryId);
    if (error) return { error: error.code === "23505" ? "That slug is already used" : friendlyDbError(error) };
    await logAdminAction(supabase, "category.update", "category", categoryId, { name: parsed.data.name });
  } else {
    const { data, error } = await supabase.from("categories").insert(parsed.data).select("id").single();
    if (error) return { error: error.code === "23505" ? "That slug is already used" : friendlyDbError(error) };
    await logAdminAction(supabase, "category.create", "category", data.id, { name: parsed.data.name });
  }
  revalidateEverywhere();
  return { ok: true, message: categoryId ? "Saved" : "Category added" };
}

/** Refuses to delete a category that events still use. */
export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const { supabase } = await adminContext();
  if (!z.uuid().safeParse(categoryId).success) return { ok: false, error: "Invalid category" };
  const { data: cat } = await supabase.from("categories").select("id, name, slug").eq("id", categoryId).maybeSingle();
  if (!cat) return { ok: false, error: "Category not found" };
  const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("category_id", categoryId);
  if (count) return { ok: false, error: `${count} event${count === 1 ? " uses" : "s use"} this category. Move ${count === 1 ? "it" : "them"} to another category first.` };
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) return { ok: false, error: friendlyDbError(error) };
  await logAdminAction(supabase, "category.delete", "category", categoryId, { name: cat.name });
  revalidateEverywhere();
  return { ok: true, message: `Deleted ${cat.name}` };
}
