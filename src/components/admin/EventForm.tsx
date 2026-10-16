"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClass } from "@/components/ui/Button";
import type { EventFormState } from "@/app/admin/events/actions";
import { EVENT_FORMATS } from "@/lib/taxonomy";

export type EventFormValues = {
  title?: string; summary?: string | null; description?: string | null;
  starts_local?: string; ends_local?: string;
  format?: string; venue_name?: string | null; address?: string | null; city?: string | null;
  organiser_id?: string | null; category_id?: string | null; tags?: string[];
  registration_mode?: "external" | "none"; external_url?: string | null; external_label?: string | null;
  price_min?: number | null; price_max?: number | null; source_url?: string | null;
};

type Option = { id: string; name: string };

/** Add / edit an admin-managed event. Times are typed in UK time. */
export function EventForm({ action, values = {}, organisers, categories, submitLabel }: {
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>;
  values?: EventFormValues;
  organisers: Option[];
  categories: Option[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [mode, setMode] = useState<"external" | "none">(values.registration_mode ?? "external");
  const err = (k: string) => state?.fieldErrors?.[k] ?? null;
  const common = (k: string) => ({ id: `f-${k}`, name: k, "aria-invalid": err(k) ? true : undefined });

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Card title="Basics">
        <Field label="Title" htmlFor="f-title" error={err("title")} required>
          <Input {...common("title")} defaultValue={values.title ?? ""} maxLength={140} required />
        </Field>
        <Field label="Summary" htmlFor="f-summary" error={err("summary")} hint="One line shown on cards (max 200 characters).">
          <Input {...common("summary")} defaultValue={values.summary ?? ""} maxLength={200} />
        </Field>
        <Field label="Description" htmlFor="f-description" error={err("description")}>
          <Textarea {...common("description")} defaultValue={values.description ?? ""} rows={6} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="f-category_id" error={err("category_id")}>
            <Select {...common("category_id")} defaultValue={values.category_id ?? ""}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Organiser" htmlFor="f-organiser_id" error={err("organiser_id")} hint="Optional — leave empty for events listed on someone's behalf.">
            <Select {...common("organiser_id")} defaultValue={values.organiser_id ?? ""}>
              <option value="">No organiser</option>
              {organisers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Tags" htmlFor="f-tags" error={err("tags")} hint="Comma or semicolon separated, e.g. finance, networking">
          <Input {...common("tags")} defaultValue={(values.tags ?? []).join(", ")} />
        </Field>
      </Card>

      <Card title="When & where">
        <p className="-mt-1 text-xs text-muted">Times are UK time (GMT/BST); we convert to UTC when saving.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" htmlFor="f-starts_local" error={err("starts_local")} required>
            <Input {...common("starts_local")} type="datetime-local" defaultValue={values.starts_local ?? ""} required />
          </Field>
          <Field label="Ends" htmlFor="f-ends_local" error={err("ends_local")}>
            <Input {...common("ends_local")} type="datetime-local" defaultValue={values.ends_local ?? ""} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Format" htmlFor="f-format">
            <Select {...common("format")} defaultValue={values.format ?? "in_person"}>
              {EVENT_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </Field>
          <Field label="Venue" htmlFor="f-venue_name" error={err("venue_name")}>
            <Input {...common("venue_name")} defaultValue={values.venue_name ?? ""} />
          </Field>
          <Field label="City" htmlFor="f-city" error={err("city")}>
            <Input {...common("city")} defaultValue={values.city ?? "London"} />
          </Field>
        </div>
        <Field label="Address" htmlFor="f-address" error={err("address")}>
          <Input {...common("address")} defaultValue={values.address ?? ""} />
        </Field>
      </Card>

      <Card title="Registration & price">
        <fieldset className="space-y-3">
          <legend className="sr-only">How people register</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["external", "External link", "Button sends people to another site"],
              ["none", "Info only", "No registration — just listing it"],
            ] as const).map(([v, label, hint]) => (
              <label
                key={v}
                className={`cursor-pointer rounded-2xl border p-3.5 text-sm transition-colors ${mode === v ? "border-accent/50 bg-accent/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
              >
                <input type="radio" name="registration_mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="sr-only" />
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </label>
            ))}
          </div>
          {err("registration_mode") && <p className="text-xs text-red-300">{err("registration_mode")}</p>}
        </fieldset>
        {mode === "external" && (
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Registration link" htmlFor="f-external_url" error={err("external_url")} required>
              <Input {...common("external_url")} type="url" placeholder="https://" defaultValue={values.external_url ?? ""} />
            </Field>
            <Field label="Button label" htmlFor="f-external_label" error={err("external_label")}>
              <Input {...common("external_label")} defaultValue={values.external_label ?? "Apply now"} maxLength={40} />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price from (£)" htmlFor="f-price_min" error={err("price_min")} hint="0 = free. Leave both empty if unknown.">
            <Input {...common("price_min")} type="number" min={0} step="0.01" defaultValue={values.price_min ?? ""} />
          </Field>
          <Field label="Price to (£)" htmlFor="f-price_max" error={err("price_max")}>
            <Input {...common("price_max")} type="number" min={0} step="0.01" defaultValue={values.price_max ?? ""} />
          </Field>
        </div>
        <Field label="Source link" htmlFor="f-source_url" error={err("source_url")} hint="Where you found it (for your own reference and the “source” link).">
          <Input {...common("source_url")} type="url" placeholder="https://" defaultValue={values.source_url ?? ""} />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
        <Link href="/admin/events" className={buttonClass({ variant: "ghost", size: "lg" })}>Cancel</Link>
        <FormMessage state={state?.error ? { error: state.error } : null} />
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass space-y-4 rounded-[20px] p-6">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
