"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { releaseImages } from "@/lib/cloudinary-release";
import { sourceKey } from "@/lib/sources/types";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./actions";

const PATH = "/admin/sources";
const idSchema = z.uuid();

/**
 * Deletes a source. When "remove events" is ticked, its upcoming events are permanently deleted
 * from the database (registrations, tickets and related rows cascade), not just hidden.
 */
export async function deleteSource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Unknown source" };
  const removeEvents = formData.get("remove_events") === "on";

  const supabase = await createClient();
  if (removeEvents) {
    const { data: removed, error } = await supabase
      .from("events")
      .delete()
      .eq("source", sourceKey(id.data))
      .gte("starts_at", new Date().toISOString())
      .select("cover_url");
    if (error) return { ok: false, error: error.message };
    await releaseImages((removed ?? []).map((e) => e.cover_url as string | null));
  }

  const { error } = await supabase.from("event_sources").delete().eq("id", id.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  redirect(PATH);
}
