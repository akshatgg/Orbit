"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { apiMessage } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import type { ActionState } from "./actions";

const PATH = "/admin/sources";
const idSchema = z.uuid();

/**
 * Deletes a source. When "remove events" is ticked, its upcoming events are permanently deleted
 * (registrations, tickets and related rows cascade, unused covers are released), not just hidden.
 */
export async function deleteSource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Unknown source" };
  const events = formData.get("remove_events") === "on" ? "delete" : "keep";

  try {
    await authed.del(`/admin/sources/${id.data}`, { query: { events } });
  } catch (error) {
    return { ok: false, error: apiMessage(error, {}, { passThrough: true }) };
  }

  revalidatePath(PATH);
  redirect(PATH);
}
