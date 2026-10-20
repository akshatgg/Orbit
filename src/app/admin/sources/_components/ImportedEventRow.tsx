/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { uploadImage } from "@/lib/storage";
import type { ImportedEvent } from "@/lib/sources/queries";
import type { ActionState } from "../actions";
import { ActionButton } from "./ActionButton";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS = {
  ok: { tone: "success", text: "Details read" },
  failed: { tone: "warning", text: "Details failed" },
  blocked: { tone: "danger", text: "Blocked by Luma" },
} as const;

export function ImportedEventRow({ event, action, retry }: { event: ImportedEvent; action: Action; retry: Action }) {
  const [state, formAction] = useActionState(action, null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const preview = uploaded ?? event.cover_url;
  const foreignCurrency = event.price_min !== null && event.currency !== "GBP";
  const status = event.details ? STATUS[event.details.status] : null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      setUploaded(await uploadImage("event-covers", file));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <details className="glass rounded-[20px] p-4">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{event.title}</span>
        <span className="text-xs text-muted">{when(event.starts_at)}</span>
        {!event.cover_url && <Badge tone="warning">No cover</Badge>}
        {status ? <Badge tone={status.tone}>{status.text}</Badge> : <Badge>Not read yet</Badge>}
      </summary>

      <div className="mt-4 grid gap-5 md:grid-cols-[12rem_1fr]">
        <div className="space-y-2">
          <div className="aspect-[2/1] overflow-hidden rounded-xl border border-line bg-ink/[0.04]">
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          {event.external_url && (
            <a href={event.external_url} target="_blank" rel="noreferrer" className="block text-xs text-accent hover:underline">
              Open the event page ↗
            </a>
          )}
          {event.details?.last_error && <p className="text-xs text-red-300">{event.details.last_error}</p>}
          {event.details && event.details.status !== "ok" && (
            <ActionButton action={retry} fields={{ id: event.id }} variant="ghost" pendingText="…">Try again</ActionButton>
          )}
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="cover_url" value={uploaded ?? ""} />
          <Field label="Image link" htmlFor={`img-${event.id}`} hint="On the event page: right-click the cover → Copy image address, then paste. ORBIT keeps its own copy.">
            <Input id={`img-${event.id}`} name="image_url" type="text" inputMode="url" placeholder="https://cdn.lu.ma/…" />
          </Field>
          <Field label="…or upload an image" htmlFor={`file-${event.id}`} hint={uploading ? "Uploading…" : uploadError ?? "JPG, PNG or WebP, up to 5 MB."}>
            <Input id={`file-${event.id}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0])} />
          </Field>
          {event.kind === "luma" && (
            <Field label="Description" htmlFor={`desc-${event.id}`}>
              <Textarea id={`desc-${event.id}`} name="description" rows={5} maxLength={5000} defaultValue={event.description ?? ""} />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price from (£)" htmlFor={`pmin-${event.id}`} hint={foreignCurrency ? `Currently ${event.currency} — saving a new price stores it in £.` : "0 = free. Empty = unknown."}>
              <Input id={`pmin-${event.id}`} name="price_min" type="number" min={0} step="0.01" defaultValue={event.price_min ?? ""} />
            </Field>
            <Field label="Price to (£)" htmlFor={`pmax-${event.id}`}>
              <Input id={`pmax-${event.id}`} name="price_max" type="number" min={0} step="0.01" defaultValue={event.price_max ?? ""} />
            </Field>
          </div>
          <FormMessage state={state} />
          <SubmitButton disabled={uploading}>Save details</SubmitButton>
        </form>
      </div>
    </details>
  );
}
