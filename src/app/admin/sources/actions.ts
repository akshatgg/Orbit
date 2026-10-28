"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { apiMessage } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import { importedDetailsSchema } from "@/lib/sources/details-schema";
import { DEFAULT_ATTRIBUTION, resolveFeedUrl } from "@/lib/sources/feed-url";
import { parseIdList } from "@/lib/sources/review";
import { IMPORTED_KINDS as IMPORTED_SOURCE_KINDS, SOURCE_KINDS, sourceIdFromKey, type RunError } from "@/lib/sources/types";

export type ActionState = { ok: boolean; error?: string; message?: string } | null;

const PATH = "/admin/sources";

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid({ message: "Pick an option from the list" }).nullable());

const sourceSchema = z
  .object({
    id: optionalId,
    name: z.string().trim().min(2, "Give the source a name").max(80, "Keep the name under 80 characters"),
    kind: z.enum(SOURCE_KINDS, { message: "Pick a source type" }),
    url: z.string().trim().min(1, "Add the feed URL").max(2000, "That URL is too long"),
    default_organiser_id: optionalId,
    default_category_id: optionalId,
    default_tags: z
      .string()
      .max(400)
      .transform((v) =>
        [...new Set(v.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean))].slice(0, 10),
      )
      .pipe(z.array(z.string().max(30, "Keep each tag under 30 characters"))),
    attribution: z.string().trim().max(200, "Keep attribution under 200 characters").transform((v) => v || null),
    permission_confirmed: z.boolean(),
    permission_note: z.string().trim().max(1000, "Keep the note under 1000 characters").transform((v) => v || null),
    enabled: z.boolean(),
    auto_category: z.boolean(),
  })
  .transform((s, ctx) => {
    const resolved = resolveFeedUrl(s.kind, s.url);
    if (!resolved.ok) {
      ctx.addIssue({ code: "custom", message: resolved.error, path: ["url"] });
      return z.NEVER;
    }
    return { ...s, url: resolved.url, attribution: s.attribution ?? DEFAULT_ATTRIBUTION[s.kind] ?? null };
  })
  .refine((s) => !s.enabled || (s.permission_confirmed && s.permission_note), {
    message: "Confirm you have permission to use this feed, and note who granted it, before enabling it.",
    path: ["enabled"],
  });

const firstError = (error: z.ZodError) => error.issues[0]?.message ?? "Check the form and try again.";

/** The API's own sentence for a refused call (they're written for admins), else a generic one. */
function failure(error: unknown): ActionState {
  return { ok: false, error: apiMessage(error, {}, { passThrough: true, fallback: "Something went wrong. Try again." }) };
}

export async function saveSource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = sourceSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    kind: formData.get("kind") ?? "ical",
    url: formData.get("url") ?? "",
    default_organiser_id: formData.get("default_organiser_id") ?? "",
    default_category_id: formData.get("default_category_id") ?? "",
    default_tags: formData.get("default_tags") ?? "",
    attribution: formData.get("attribution") ?? "",
    permission_confirmed: formData.get("permission_confirmed") === "on",
    permission_note: formData.get("permission_note") ?? "",
    enabled: formData.get("enabled") === "on",
    auto_category: formData.get("auto_category") === "on",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { id, ...values } = parsed.data;
  try {
    if (id) await authed.patch(`/admin/sources/${id}`, { body: values });
    else await authed.post("/admin/sources", { body: values });
  } catch (error) {
    return failure(error);
  }

  revalidatePath(PATH);
  redirect(PATH);
}

const idSchema = z.uuid();

export async function setSourceEnabled(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Unknown source" };
  const enable = formData.get("enabled") === "true";

  try {
    await authed.post(`/admin/sources/${id.data}/enabled`, { body: { on: enable } });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: enable ? "Enabled — it'll refresh nightly." : "Disabled." };
}

export async function runSourceNow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Unknown source" };

  // The API refuses a source without recorded permission, and looks for duplicates after a good run.
  let result: RunResult;
  try {
    result = await authed.post<RunResult>(`/admin/sources/${id.data}/run`, { signal: AbortSignal.timeout(290_000) });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PATH, "layout");

  if (result.status === "error") return { ok: false, error: result.errors[0]?.message ?? "The run failed." };
  const parts = [
    `${result.found} found`, `${result.inserted} new`, `${result.updated} updated`, `${result.unchanged} unchanged`,
  ];
  if (result.flagged_missing) parts.push(`${result.flagged_missing} flagged`);
  if (result.errors.length) parts.push(`${result.errors.length} skipped`);
  return { ok: true, message: parts.join(" · ") };
}

type RunResult = {
  status: "ok" | "error";
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  flagged_missing: number;
  errors: RunError[];
};

const reviewSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["not_duplicate", "keep_hidden", "reviewed"]),
});

export async function resolveReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = reviewSchema.safeParse({ id: formData.get("id"), decision: formData.get("decision") });
  if (!parsed.success) return { ok: false, error: "Unknown event" };
  const { id, decision } = parsed.data;

  try {
    await authed.post(`/admin/sources/review/${id}`, { body: { decision } });
  } catch (error) {
    return failure(error);
  }

  revalidatePath(PATH, "layout");
  return {
    ok: true,
    message: { not_duplicate: "Marked as not a duplicate — it's visible again.", keep_hidden: "Kept hidden as a duplicate.", reviewed: "Marked reviewed." }[decision],
  };
}

/**
 * "Mark reviewed" for many events at once (the review dashboard's selection). Only clears events
 * that still wait for review and aren't duplicates: a duplicate needs its own decision.
 */
export async function markReviewedBulk(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const ids = parseIdList(formData.get("ids"));
  if (!ids) return { ok: false, error: "Pick at least one event (up to 500 at a time)." };
  let n: number;
  try {
    ({ updated: n } = await authed.post<{ updated: number }>("/admin/sources/review/bulk", { body: { ids } }));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PATH, "layout");
  return { ok: true, message: `Marked ${n} event${n === 1 ? "" : "s"} reviewed.` };
}

const IMPORTED_KINDS = new Set<string>(IMPORTED_SOURCE_KINDS);
/** Kinds whose feed doesn't own the description, so an admin's one survives every sync. */
const EDITABLE_DESCRIPTION = new Set(["luma", "luma-discover", "eventbrite"]);

type EventPrices = { id: string; source: string; price_min: number | string | null; price_max: number | string | null; currency: string };

/** Admin fallback for imported events: cover (pasted link or upload), description, price. */
export async function saveImportedDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = importedDetailsSchema.safeParse({
    id: formData.get("id") ?? "",
    image_url: formData.get("image_url") ?? "",
    cover_url: formData.get("cover_url") ?? "",
    description: formData.get("description") ?? "",
    price_min: formData.get("price_min") ?? "",
    price_max: formData.get("price_max") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { id, image_url, cover_url, description, price_min, price_max } = parsed.data;

  try {
    const event = await authed.get<EventPrices>(`/admin/events/${id}`);
    const sourceId = sourceIdFromKey(event.source);
    const source = sourceId ? await authed.get<{ kind: string }>(`/admin/sources/${sourceId}`).catch(() => null) : null;
    if (!source || !IMPORTED_KINDS.has(source.kind)) {
      return { ok: false, error: "Only events imported from Luma, Meetup, Eventbrite or Fatsoma can be edited here." };
    }

    const patch: Record<string, unknown> = {};
    // Meetup and Fatsoma descriptions belong to the feed, so only the others take one from the form.
    if (EDITABLE_DESCRIPTION.has(source.kind)) patch.description = description;
    // Only a changed price is (re)stored in £; unrelated saves leave the stored currency alone.
    const same = (a: unknown, b: number | null) => (a === null || a === undefined ? null : Number(a)) === b;
    if (!same(event.price_min, price_min) || !same(event.price_max, price_max)) {
      patch.price_min = price_min;
      patch.price_max = price_max;
      if (price_min !== null) patch.currency = "GBP";
    }
    // An uploaded image is already on Cloudinary; a pasted link is used as it is.
    const cover = cover_url ?? image_url;
    if (cover) patch.cover_url = cover;
    if (Object.keys(patch).length > 0) await authed.put(`/admin/sources/imported/${id}`, { body: patch });
  } catch (error) {
    return failure(error);
  }

  revalidatePath(PATH);
  return { ok: true, message: "Saved." };
}

/** Lets the next refresh read this event's page again. */
export async function retryPageDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Unknown event" };
  try {
    await authed.post(`/admin/sources/imported/${id.data}/retry-details`);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PATH);
  return { ok: true, message: "Will try again on the next refresh." };
}
