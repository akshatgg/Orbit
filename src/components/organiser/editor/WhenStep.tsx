"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { newKey } from "@/lib/organiser/event-form";
import { MAX_EXTRA_DATES, nextWeek, weeklyUntil } from "@/lib/organiser/repeat";
import { londonZoneLabel } from "@/lib/organiser/time";
import { Segmented, StepIntro, type StepProps } from "./fields";

const FORMATS = [
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export function WhenStep({ form, update, errors, canAddDates = true, seriesDates = 1 }: StepProps & {
  /** New events (and drafts) can add more dates; a live event edits just its own date. */
  canAddDates?: boolean;
  seriesDates?: number;
}) {
  const physical = form.format !== "online";
  const online = form.format !== "in_person";
  const zone = londonZoneLabel(form.starts_at);

  return (
    <div className="space-y-5">
      <StepIntro title="When & where">All times are UK time{zone ? ` (${zone} on the start date)` : ""}.</StepIntro>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="starts_at" required error={errors.starts_at}>
          <Input id="starts_at" type="datetime-local" value={form.starts_at} aria-invalid={!!errors.starts_at}
            onChange={(e) => update({ starts_at: e.target.value })} />
        </Field>
        <Field label="Ends" htmlFor="ends_at" error={errors.ends_at}>
          <Input id="ends_at" type="datetime-local" value={form.ends_at} min={form.starts_at || undefined} aria-invalid={!!errors.ends_at}
            onChange={(e) => update({ ends_at: e.target.value })} />
        </Field>
      </div>

      {seriesDates > 1 && (
        <p className="rounded-[14px] border border-line bg-ink/[0.03] p-3.5 text-sm text-muted">
          This is one of {seriesDates} dates of a repeating event. Changes here apply to this date only.
        </p>
      )}
      {canAddDates && <MoreDates form={form} update={update} errors={errors} />}

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Format</p>
        <Segmented label="Event format" value={form.format} options={FORMATS} onChange={(format) => update({ format })} />
      </div>

      {physical && (
        <div className="space-y-4 glass rounded-[22px] p-4">
          <Field label="Venue" htmlFor="venue_name" required error={errors.venue_name}>
            <Input id="venue_name" value={form.venue_name} maxLength={120} placeholder="e.g. Imperial College Business School, Room 301"
              aria-invalid={!!errors.venue_name} onChange={(e) => update({ venue_name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Address" htmlFor="address" error={errors.address}>
              <Input id="address" value={form.address} maxLength={200} autoComplete="street-address" placeholder="Exhibition Rd, South Kensington"
                onChange={(e) => update({ address: e.target.value })} />
            </Field>
            <Field label="City" htmlFor="city" error={errors.city}>
              <Input id="city" value={form.city} maxLength={60} onChange={(e) => update({ city: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {online && (
        <div className="space-y-4 glass rounded-[22px] p-4">
          <Field label="Online link" htmlFor="online_url" error={errors.online_url}
            hint="Zoom, Teams, Meet… Only people with a ticket can see this.">
            <Input id="online_url" inputMode="url" value={form.online_url} placeholder="https://zoom.us/j/…"
              aria-invalid={!!errors.online_url} onChange={(e) => update({ online_url: e.target.value })} />
          </Field>
        </div>
      )}

      <Field label="Info for guests" htmlFor="guest_info" error={errors.guest_info}
        hint="Door code, dress code, what to bring. Shown only to registered guests.">
        <Textarea id="guest_info" rows={3} maxLength={1000} value={form.guest_info} onChange={(e) => update({ guest_info: e.target.value })} />
      </Field>
    </div>
  );
}

/**
 * The same event on more dates (like a weekly meetup): add dates one by one or fill weekly up to an
 * end date. Publishing creates one event per date, each with its own tickets and guest list.
 */
function MoreDates({ form, update, errors }: StepProps) {
  const [on, setOn] = useState(form.extra_dates.length > 0);
  const [until, setUntil] = useState("");
  const dates = form.extra_dates;
  const first = { starts_at: form.starts_at, ends_at: form.ends_at };
  const full = dates.length >= MAX_EXTRA_DATES;

  function toggle(next: boolean) {
    setOn(next);
    update({ extra_dates: next && form.starts_at ? [nextWeek(first, newKey())] : [] });
  }
  const setDate = (i: number, patch: Partial<(typeof dates)[number]>) =>
    update({ extra_dates: dates.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const addDate = () => update({ extra_dates: [...dates, nextWeek(dates.at(-1) ?? first, newKey())] });
  const fillWeekly = () => update({ extra_dates: weeklyUntil(first, until, newKey) });

  return (
    <div className="space-y-3 glass rounded-[22px] p-4">
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
        <span>
          <span className="font-medium">This event happens on more than one date</span>
          <span className="block text-xs text-muted">
            Same details, venue and tickets on every date. Each date gets its own capacity and guest list.
          </span>
        </span>
      </label>

      {on && !form.starts_at && <p className="text-xs text-orange">Set the first date above, then add the others.</p>}

      {on && form.starts_at && (
        <>
          <ol className="space-y-2.5">
            {dates.map((d, i) => (
              <li key={d.key} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Field label={`Date ${i + 2} · starts`} htmlFor={`extra-start-${d.key}`} error={errors[`extra_dates.${i}.starts_at`]}>
                  <Input id={`extra-start-${d.key}`} type="datetime-local" value={d.starts_at}
                    onChange={(e) => setDate(i, { starts_at: e.target.value })} />
                </Field>
                <Field label="Ends" htmlFor={`extra-end-${d.key}`} error={errors[`extra_dates.${i}.ends_at`]}>
                  <Input id={`extra-end-${d.key}`} type="datetime-local" value={d.ends_at} min={d.starts_at || undefined}
                    onChange={(e) => setDate(i, { ends_at: e.target.value })} />
                </Field>
                <button type="button" onClick={() => update({ extra_dates: dates.filter((_, j) => j !== i) })}
                  className={`${buttonClass({ variant: "secondary" })} h-[46px]`} aria-label={`Remove date ${i + 2}`}>
                  Remove
                </button>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-end gap-2">
            <button type="button" onClick={addDate} disabled={full} className={buttonClass({ variant: "secondary" })}>
              + Add a date
            </button>
            <span className="px-1 text-xs text-muted">or</span>
            <Field label="Repeat weekly until" htmlFor="repeat-until">
              <Input id="repeat-until" type="date" value={until} min={form.starts_at.slice(0, 10)} onChange={(e) => setUntil(e.target.value)} />
            </Field>
            <button type="button" onClick={fillWeekly} disabled={!until} className={buttonClass({ variant: "secondary" })}>
              Fill weekly
            </button>
          </div>

          <p className="text-xs text-muted">
            {dates.length + 1} dates in total (up to {MAX_EXTRA_DATES + 1}). They&rsquo;re all created when you publish.
          </p>
        </>
      )}
    </div>
  );
}
