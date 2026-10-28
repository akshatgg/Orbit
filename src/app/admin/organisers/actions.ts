"use server";

import { z } from "zod";
import { authed } from "@/lib/api/session";
import { adminContext, adminError, revalidateEverywhere, type ActionResult } from "@/lib/admin/server";

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

type OrganiserRef = { id: string; name: string };

async function organiserName(organiserId: string) {
  const { items } = await authed.get<{ items: OrganiserRef[] }>("/admin/organisers");
  return items.find((o) => o.id === organiserId)?.name ?? null;
}

/**
 * Approve / reject / suspend / reinstate an organiser. The API logs the decision and
 * emails the owners about approvals and rejections.
 */
export async function decideOrganiser(organiserId: string, decision: Decision, reviewNote?: string): Promise<ActionResult> {
  await adminContext();
  const parsedId = id.safeParse(organiserId);
  const parsedNote = note.safeParse(reviewNote ?? undefined);
  if (!parsedId.success || !(decision in NEXT_STATUS)) return { ok: false, error: "Invalid request" };
  if (!parsedNote.success) return { ok: false, error: "Keep the note under 500 characters" };
  if (decision === "reject" && !parsedNote.data) return { ok: false, error: "Add a note so the organiser knows why" };

  let name: string | null;
  try {
    name = await organiserName(parsedId.data);
    if (!name) return { ok: false, error: "Organiser not found" };
    await authed.post(`/admin/organisers/${parsedId.data}/decision`, {
      body: {
        decision: NEXT_STATUS[decision],
        note: decision === "approve" || decision === "reinstate" ? null : parsedNote.data || null,
      },
    });
  } catch (error) {
    return { ok: false, error: adminError(error) };
  }
  revalidateEverywhere();
  return { ok: true, message: `${name} ${MESSAGES[decision]}` };
}

/** Give or remove the ✓ verified badge. */
export async function setOrganiserVerified(organiserId: string, verified: boolean): Promise<ActionResult> {
  await adminContext();
  const parsedId = id.safeParse(organiserId);
  if (!parsedId.success) return { ok: false, error: "Invalid request" };

  let name: string | null;
  try {
    name = await organiserName(parsedId.data);
    if (!name) return { ok: false, error: "Organiser not found" };
    await authed.post(`/admin/organisers/${parsedId.data}/verify`, { body: { verified: verified === true } });
  } catch (error) {
    return { ok: false, error: adminError(error) };
  }
  revalidateEverywhere();
  return { ok: true, message: verified ? `${name} is now verified` : `Removed ${name}'s badge` };
}
