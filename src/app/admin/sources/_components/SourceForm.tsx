"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SOURCE_KINDS, SOURCE_KIND_LABELS, type EventSource, type SourceKind } from "@/lib/sources/types";
import { InterestTagsField } from "@/components/admin/InterestTagsField";
import { saveSource } from "../actions";

type Option = { id: string; name: string };

/** Kinds that pull unrelated events, so each one is worth classifying on its own. */
const DISCOVERY_KINDS: SourceKind[] = ["luma-discover", "meetup-search", "eventbrite", "fatsoma"];

const PLATFORM_NAME: Partial<Record<SourceKind, string>> = {
  luma: "Luma", "luma-discover": "Luma", meetup: "Meetup", "meetup-search": "Meetup", eventbrite: "Eventbrite", fatsoma: "Fatsoma",
};

/** Platforms whose terms don't allow this kind of import; the owner accepted the risk. */
const TERMS_WARNING: Partial<Record<SourceKind, string>> = {
  "meetup-search": "Meetup’s robots rules disallow the find-page parameters.",
  eventbrite: "Eventbrite’s terms only allow automated access through its official API; this reads the JSON its own website uses.",
  fatsoma: "Fatsoma’s terms (clause 5.1.6) don’t allow copying or storing its content.",
};

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
  "luma-discover": {
    label: "Luma link",
    hint: "A city page (https://lu.ma/london) imports the whole city; a single event link imports just that event.",
    placeholder: "https://lu.ma/london",
  },
  meetup: {
    label: "Meetup group link",
    hint: "The group's page, e.g. https://www.meetup.com/your-group/. ORBIT finds its calendar feed.",
    placeholder: "https://www.meetup.com/your-group/",
  },
  "meetup-search": {
    label: "Meetup link",
    hint: "A single event link imports one event; a find page (…/find/?categoryId=…) imports every matching event. Without a location parameter, Meetup’s default location is used.",
    placeholder: "https://www.meetup.com/find/?location=…",
  },
  eventbrite: {
    label: "Eventbrite link",
    hint: "An organiser page (…/o/name-123) imports all their live events; a search page (…/d/united-kingdom--london/…) imports its first 40 results; an event page imports just that event.",
    placeholder: "https://www.eventbrite.co.uk/o/…",
  },
  fatsoma: {
    label: "Fatsoma link",
    hint: "An organiser page (…/p/name) imports all their events; a city page (…/l/gb/london) imports the city’s next 250; an event page imports just that event.",
    placeholder: "https://www.fatsoma.com/p/…",
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
  const [autoCategory, setAutoCategory] = useState(source?.auto_category ?? false);
  // Until the admin touches it, the switch follows the kind: discovery feeds start classified.
  const [autoTouched, setAutoTouched] = useState(Boolean(source));

  const changeKind = (next: SourceKind) => {
    setKind(next);
    if (!autoTouched) setAutoCategory(DISCOVERY_KINDS.includes(next));
  };

  return (
    <form action={formAction} onReset={() => setKind(source?.kind ?? "ical")} className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <input type="hidden" name="id" value={source?.id ?? ""} />

      <section className="glass space-y-5 rounded-[20px] p-6">
        <h2 className="text-base font-semibold tracking-tight">Feed</h2>
        <Field label="Name" htmlFor="name" required hint="Shown to admins, e.g. “Imperial Careers Service calendar”.">
          <Input id="name" name="name" required minLength={2} maxLength={80} defaultValue={source?.name ?? ""} />
        </Field>
        <Field label="Type" htmlFor="kind" hint="Platform sources link each event back to its page there.">
          <Select id="kind" name="kind" value={kind} onChange={(e) => changeKind(e.target.value as SourceKind)}>
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
        <InterestTagsField
          name="default_tags"
          label="Interests & tags"
          defaultValue={source?.default_tags ?? []}
          hint="added to every event from this link, on top of the interests ORBIT detects."
        />
        <label className="flex items-start gap-3 rounded-[14px] border border-line bg-ink/[0.03] p-3.5 text-sm">
          <input
            type="checkbox"
            name="auto_category"
            checked={autoCategory}
            onChange={(e) => {
              setAutoCategory(e.target.checked);
              setAutoTouched(true);
            }}
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          />
          <span>
            <span className="font-medium">Categorise each event automatically</span>
            <span className="block text-xs text-muted">
              Scores each new event&rsquo;s title, tags and text against the category keywords (managed
              under Categories). Anything unclear keeps the default category above.
            </span>
          </span>
        </label>
        <Field label="Attribution" htmlFor="attribution" hint="Credit line the source asks for, if any.">
          <Input id="attribution" name="attribution" maxLength={200} placeholder={PLATFORM_NAME[kind] ? `Leave empty for “From ${PLATFORM_NAME[kind]}”` : "Events from Imperial Careers Service"} defaultValue={source?.attribution ?? ""} />
        </Field>
      </section>

      <aside className="space-y-5">
        <section className="glass space-y-4 rounded-[20px] p-6">
          <h2 className="text-base font-semibold tracking-tight">Permission</h2>
          <p className="text-sm text-muted">
            Feed sources use only feeds we&rsquo;re allowed to. Discovery sources read public listing pages — check the
            platform&rsquo;s terms or get written OK first.
          </p>
          {TERMS_WARNING[kind] && (
            <p className="rounded-xl border border-orange/25 bg-orange/10 p-3 text-xs text-orange">
              {TERMS_WARNING[kind]} Only enable this if you accept that risk and will disable it if {PLATFORM_NAME[kind]} asks.
            </p>
          )}
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
