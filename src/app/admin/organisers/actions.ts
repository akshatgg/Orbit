"use server";

import { z } from "zod";
import { notifyOrganiserDecision } from "@/lib/notifications";
import { adminContext, friendlyDbError, logAdminAction, revalidateEverywhere, type ActionResult } from "@/lib/admin/server";

const id = z.uuid();
const note = z.string().trim().max(500).optional();

type Decision = "approve" | "reject" | "suspend" | "reinstate";

const NEXT_STATUS: Record<Decision, "approved" | "rejected" | "suspended"> = {
  approve: "approved",
  reject: "rejected",
  suspend: "suspended",
  reinstate: "approved",
};

const MESSAGES: Record<Decision, string> = {
  approve: "approved — their events can go live",
  reject: "rejected",
  suspend: "suspended",
  reinstate: "reinstated",
};

/** Approve / reject / suspend / reinstate an organiser. RLS + guard_organiser_update allow admins only. */
export async function decideOrganiser(organiserId: string, decision: Decision, reviewNote?: string): Promise<ActionResult> {
  const { profile, supabase } = await adminContext();
  const parsedId = id.safeParse(organiserId);
  const parsedNote = note.safeParse(reviewNote ?? undefined);
  if (!parsedId.success || !(decision in NEXT_STATUS)) return { ok: false, error: "Invalid request" };
  if (!parsedNote.success) return { ok: false, error: "Keep the note under 500 characters" };
  if (decision === "reject" && !parsedNote.data) return { ok: false, error: "Add a note so the organiser knows why" };

  const status = NEXT_STATUS[decision];
  const { data, error } = await supabase
    .from("organisers")
    .update({
      status,
      review_note: decision === "approve" || decision === "reinstate" ? null : parsedNote.data || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsedId.data)
    .select("id, name")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!data) return { ok: false, error: "Organiser not found" };

  await logAdminAction(supabase, `organiser.${decision}`, "organiser", data.id, {
    name: data.name, ...(parsedNote.data ? { note: parsedNote.data } : {}),
  });
  // Owners hear about approvals and rejections by email (never throws, runs after the response).
  if (decision === "approve" || decision === "reject") await notifyOrganiserDecision(data.id);
  revalidateEverywhere();
  return { ok: true, message: `${data.name} ${MESSAGES[decision]}` };
}

/** Give or remove the ✓ verified badge. */
export async function setOrganiserVerified(organiserId: string, verified: boolean): Promise<ActionResult> {
  const { profile, supabase } = await adminContext();
  const parsedId = id.safeParse(organiserId);
  if (!parsedId.success) return { ok: false, error: "Invalid request" };

  const { data, error } = await supabase
    .from("organisers")
    .update({ is_verified: verified === true, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .select("id, name")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!data) return { ok: false, error: "Organiser not found" };

  await logAdminAction(supabase, verified ? "organiser.verify" : "organiser.unverify", "organiser", data.id, { name: data.name });
  revalidateEverywhere();
  return { ok: true, message: verified ? `${data.name} is now verified` : `Removed ${data.name}'s badge` };
}
