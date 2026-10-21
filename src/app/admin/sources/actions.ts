"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { importRemoteImage } from "@/lib/sources/cloudinary-import";
import { importedDetailsSchema } from "@/lib/sources/details-schema";
import { detectDuplicates, runSource } from "@/lib/sources/engine";
import { DEFAULT_ATTRIBUTION, resolveFeedUrl } from "@/lib/sources/platforms";
import { SOURCE_KINDS, sourceIdFromKey, sourceKey } from "@/lib/sources/types";
import { createClient } from "@/lib/supabase/server";

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

function dbError(error: { code?: string; message: string }) {
  if (error.code === "23505") return "That feed has already been added.";
  if (error.code === "23514") return "A source can only be enabled once permission is confirmed and noted.";
  return error.message;
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
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("event_sources").update(values).eq("id", id)
    : await supabase.from("event_sources").insert(values);
  if (error) return { ok: false, error: dbError(error) };

  revalidatePath(PATH);
  redirect(PATH);
}

const idSchema = z.uuid();

export async function setSourceEnabled(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Unknown source" };
  const enable = formData.get("enabled") === "true";

  const supabase = await createClient();
  if (enable) {
    const { data } = await supabase.from("event_sources").select("permission_confirmed, permission_note").eq("id", id.data).maybeSingle();
    if (!data) return { ok: false, error: "Unknown source" };
    if (!data.permission_confirmed || !data.permission_note?.trim()) {
      return { ok: false, error: "Confirm permission (and who granted it) on the source before enabling it." };
    }
  }
  const { error } = await supabase.from("event_sources").update({ enabled: enable }).eq("id", id.data);
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath(PATH);
  return { ok: true, message: enable ? "Enabled — it'll refresh nightly." : "Disabled." };
}

export async function deleteSource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Unknown source" };
  const removeEvents = formData.get("remove_events") === "on";

  const supabase = await createClient();
  if (removeEvents) {
    const { error } = await supabase
      .from("events")
      .update({ status: "removed" })
      .eq("source", sourceKey(id.data))
      .gte("starts_at", new Date().toISOString())
      .in("status", ["published", "draft"]);
    if (error) return { ok: false, error: error.message };
  }
  const { error } = await supabase.from("event_sources").delete().eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  redirect(PATH);
}

export async function runSourceNow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Unknown source" };

  // Re-read through the admin's own client (RLS) before handing over to the sync engine.
  const supabase = await createClient();
  const { data: source } = await supabase.from("event_sources").select("id, permission_confirmed").eq("id", id.data).maybeSingle();
  if (!source) return { ok: false, error: "Unknown source" };
  if (!source.permission_confirmed) return { ok: false, error: "Confirm permission to use this feed before running it." };

  const result = await runSource(id.data, { trigger: "manual" });
  const duplicates = result.status === "ok" ? await detectDuplicates() : 0;
  revalidatePath(PATH, "layout");

  if (result.status === "error") return { ok: false, error: result.errors[0]?.message ?? "The run failed." };
  const parts = [
    `${result.found} found`, `${result.inserted} new`, `${result.updated} updated`, `${result.unchanged} unchanged`,
  ];
  if (result.flaggedMissing) parts.push(`${result.flaggedMissing} flagged`);
  if (duplicates) parts.push(`${duplicates} possible duplicate${duplicates === 1 ? "" : "s"}`);
  if (result.errors.length) parts.push(`${result.errors.length} skipped`);
  return { ok: true, message: parts.join(" · ") };
}

const reviewSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["not_duplicate", "keep_hidden", "reviewed"]),
});

export async function resolveReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = reviewSchema.safeParse({ id: formData.get("id"), decision: formData.get("decision") });
  if (!parsed.success) return { ok: false, error: "Unknown event" };
  const { id, decision } = parsed.data;

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, duplicate_of").eq("id", id).maybeSingle();
  if (!event) return { ok: false, error: "That event no longer exists." };

  if (decision === "not_duplicate") {
    if (event.duplicate_of) {
      const [a, b] = [event.id, event.duplicate_of as string].sort();
      const { error } = await supabase
        .from("event_duplicate_dismissals")
        .upsert({ event_id: a, other_event_id: b }, { onConflict: "event_id,other_event_id", ignoreDuplicates: true });
      if (error) return { ok: false, error: error.message };
    }
    const { error } = await supabase.from("events").update({ duplicate_of: null, needs_review: false }).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    if (decision === "keep_hidden" && !event.duplicate_of) return { ok: false, error: "This event isn't marked as a duplicate." };
    const { error } = await supabase.from("events").update({ needs_review: false }).eq("id", id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(PATH, "layout");
  return {
    ok: true,
    message: { not_duplicate: "Marked as not a duplicate — it's visible again.", keep_hidden: "Kept hidden as a duplicate.", reviewed: "Marked reviewed." }[decision],
  };
}

const IMPORTED_KINDS = new Set(["luma", "luma-discover", "meetup", "meetup-search"]);

/** Admin fallback for imported events: cover (pasted link or upload), description, price. */
export async function saveImportedDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
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

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, source, price_min, price_max, currency").eq("id", id).maybeSingle();
  if (!event) return { ok: false, error: "That event no longer exists." };
  const sourceId = sourceIdFromKey(event.source as string);
  const { data: source } = sourceId
    ? await supabase.from("event_sources").select("kind").eq("id", sourceId).maybeSingle()
    : { data: null };
  if (!source || !IMPORTED_KINDS.has(source.kind as string)) {
    return { ok: false, error: "Only Luma and Meetup events can be edited here." };
  }

  let cover = cover_url;
  if (image_url) {
    try {
      cover = await importRemoteImage(image_url, `orbit/event-covers/${admin.id}`);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't import that image." };
    }
  }

  const patch: Record<string, unknown> = {};
  // Meetup descriptions belong to the feed, so only Luma events take one from the form.
  if (source.kind === "luma" || source.kind === "luma-discover") patch.description = description;
  // Only a changed price is (re)stored in £; unrelated saves leave the stored currency alone.
  const same = (a: unknown, b: number | null) => (a === null || a === undefined ? null : Number(a)) === b;
  if (!same(event.price_min, price_min) || !same(event.price_max, price_max)) {
    patch.price_min = price_min;
    patch.price_max = price_max;
    if (price_min !== null) patch.currency = "GBP";
  }
  if (cover) patch.cover_url = cover;
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("events").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  return { ok: true, message: "Saved." };
}

/** Lets the next refresh read this event's page again. */
export async function retryPageDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Unknown event" };
  const supabase = await createClient();
  const { error } = await supabase.from("source_event_details").delete().eq("event_id", id.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true, message: "Will try again on the next refresh." };
}
