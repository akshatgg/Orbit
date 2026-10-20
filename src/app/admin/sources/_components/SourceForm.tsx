"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SOURCE_KINDS, SOURCE_KIND_LABELS, type EventSource, type SourceKind } from "@/lib/sources/types";
import { saveSource } from "../actions";

type Option = { id: string; name: string };

const URL_COPY: Record<SourceKind, { label: string; hint: string; placeholder: string }> = {
  ical: {
    label: "iCal feed URL",
    hint: "An .ics link the owner has said we can use. webcal:// links work too.",
    placeholder: "https://…/calendar.ics",
  },
  luma: {
    label: "Luma iCal link",
    hint: "On the Luma calendar page: Subscribe → Add iCal Subscription → copy the link (webcal://api.lu.ma/ics/…).",
    placeholder: "webcal://api.lu.ma/ics/get?entity=calendar&id=cal-…",
  },
  meetup: {
    label: "Meetup group link",
    hint: "The group's page, e.g. https://www.meetup.com/your-group/. ORBIT finds its calendar feed.",
    placeholder: "https://www.meetup.com/your-group/",
  },
};

export function SourceForm({ source, organisers, categories }: {
  source?: EventSource | null;
  organisers: Option[];
  categories: Option[];
}) {
  const [state, formAction] = useActionState(saveSource, null);
  const [permission, setPermission] = useState(source?.permission_confirmed ?? false);
  const [note, setNote] = useState(source?.permission_note ?? "");
  const [enabled, setEnabled] = useState(source?.enabled ?? false);
  const [kind, setKind] = useState<SourceKind>(source?.kind ?? "ical");
  const copy = URL_COPY[kind];
  const canEnable = permission && note.trim().length > 0;

  return (
    <form action={formAction} onReset={() => setKind(source?.kind ?? "ical")} className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <input type="hidden" name="id" value={source?.id ?? ""} />

      <section className="glass space-y-5 rounded-[20px] p-6">
        <h2 className="text-base font-semibold tracking-tight">Feed</h2>
        <Field label="Name" htmlFor="name" required hint="Shown to admins, e.g. “Imperial Careers Service calendar”.">
          <Input id="name" name="name" required minLength={2} maxLength={80} defaultValue={source?.name ?? ""} />
        </Field>
        <Field label="Type" htmlFor="kind" hint="Luma and Meetup sources link each event back to its page there.">
          <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>
            {SOURCE_KINDS.map((k) => <option key={k} value={k}>{SOURCE_KIND_LABELS[k]}</option>)}
          </Select>
        </Field>
        <Field label={copy.label} htmlFor="url" required hint={copy.hint}>
          <Input id="url" name="url" type="text" inputMode="url" required placeholder={copy.placeholder} defaultValue={source?.url ?? ""} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Default organiser" htmlFor="default_organiser_id" hint="Imported events are listed under this organiser.">
            <Select id="default_organiser_id" name="default_organiser_id" defaultValue={source?.default_organiser_id ?? ""}>
              <option value="">None (ORBIT listing)</option>
              {organisers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
          <Field label="Default category" htmlFor="default_category_id">
            <Select id="default_category_id" name="default_category_id" defaultValue={source?.default_category_id ?? ""}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Tags" htmlFor="default_tags" hint="Comma separated, up to 10 — added to every imported event.">
          <Input id="default_tags" name="default_tags" placeholder="careers, consulting" defaultValue={source?.default_tags.join(", ") ?? ""} />
        </Field>
        <Field label="Attribution" htmlFor="attribution" hint="Credit line the source asks for, if any.">
          <Input id="attribution" name="attribution" maxLength={200} placeholder={kind === "ical" ? "Events from Imperial Careers Service" : `Leave empty for “From ${kind === "luma" ? "Luma" : "Meetup"}”`} defaultValue={source?.attribution ?? ""} />
        </Field>
      </section>

      <aside className="space-y-5">
        <section className="glass space-y-4 rounded-[20px] p-6">
          <h2 className="text-base font-semibold tracking-tight">Permission</h2>
          <p className="text-sm text-muted">
            ORBIT only uses feeds we&rsquo;re allowed to. No scraping — check the owner&rsquo;s terms or get written OK first.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="permission_confirmed"
              checked={permission}
              onChange={(e) => {
                setPermission(e.target.checked);
                if (!e.target.checked) setEnabled(false);
              }}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span className="font-medium">We have permission to use this feed</span>
          </label>
          <Field label="Who granted it / terms checked" htmlFor="permission_note" required={permission}>
            <Textarea
              id="permission_note"
              name="permission_note"
              maxLength={1000}
              placeholder="e.g. Emailed J. Smith (Careers) on 14 Oct — OK to republish with credit."
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (!e.target.value.trim()) setEnabled(false);
              }}
            />
          </Field>
        </section>

        <section className="glass space-y-3 rounded-[20px] p-6">
          <label className={`flex items-start gap-3 text-sm ${canEnable ? "" : "opacity-60"}`}>
            <input
              type="checkbox"
              name="enabled"
              checked={enabled && canEnable}
              disabled={!canEnable}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span>
              <span className="font-medium">Enabled</span>
              <span className="block text-xs text-muted">Refreshed automatically every night.</span>
            </span>
          </label>
          {!canEnable && (
            <p className="text-xs text-orange">Confirm permission and add a note to enable this source.</p>
          )}
          <FormMessage state={state} />
          <div className="flex gap-2 pt-1">
            <SubmitButton>{source ? "Save changes" : "Add source"}</SubmitButton>
            <Link href="/admin/sources" className={buttonClass({ variant: "ghost" })}>Cancel</Link>
          </div>
        </section>
      </aside>
    </form>
  );
}
