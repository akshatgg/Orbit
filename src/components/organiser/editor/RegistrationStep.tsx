"use client";

import { Field, Input } from "@/components/ui/Field";
import { EXTERNAL_LABELS, REGISTRATION_CHOICES, usesTickets } from "@/lib/organiser/registration";
import { StepIntro, Toggle, type StepProps } from "./fields";

export function RegistrationStep({ form, update, errors }: StepProps) {
  const tickets = usesTickets(form.registration);

  return (
    <div className="space-y-5">
      <StepIntro title="Registration">How do people sign up?</StepIntro>

      <div role="radiogroup" aria-label="Registration type" className="grid gap-2.5">
        {REGISTRATION_CHOICES.map((c) => {
          const on = form.registration === c.value;
          return (
            <label key={c.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${on ? "border-gradient bg-surface" : "border-line bg-surface/50 hover:bg-surface"}`}>
              <input type="radio" name="registration" value={c.value} checked={on} className="mt-1 accent-violet"
                onChange={() => update({ registration: c.value })} />
              <span>
                <span className="block text-sm font-semibold">{c.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{c.description}</span>
              </span>
            </label>
          );
        })}
      </div>
      {errors.registration && <p className="text-xs text-red-300">{errors.registration}</p>}

      {form.registration === "external" && (
        <div className="space-y-4 rounded-2xl border border-line bg-surface/50 p-4">
          <Field label="Registration link" htmlFor="external_url" required error={errors.external_url}>
            <Input id="external_url" inputMode="url" value={form.external_url} placeholder="https://…" aria-invalid={!!errors.external_url}
              onChange={(e) => update({ external_url: e.target.value })} />
          </Field>
          <Field label="Button text" htmlFor="external_label" error={errors.external_label}>
            <Input id="external_label" value={form.external_label} maxLength={40} list="external-labels"
              onChange={(e) => update({ external_label: e.target.value })} />
            <datalist id="external-labels">{EXTERNAL_LABELS.map((l) => <option key={l} value={l} />)}</datalist>
          </Field>
        </div>
      )}

      {!tickets && (
        <Field label="Price shown on the card" htmlFor="display_price" hint="Optional. Leave blank if you don't want to show one, or 0 for free." error={errors.display_price}>
          <Input id="display_price" inputMode="decimal" value={form.display_price} placeholder="0" aria-invalid={!!errors.display_price}
            onChange={(e) => update({ display_price: e.target.value.replace(/[^\d.]/g, "") })} />
        </Field>
      )}

      {tickets && (
        <div className="space-y-4 rounded-2xl border border-line bg-surface/50 p-4">
          <Field label="Capacity" htmlFor="capacity" hint="Total places across all ticket types. Leave blank for unlimited." error={errors.capacity}>
            <Input id="capacity" inputMode="numeric" value={form.capacity} placeholder="Unlimited" aria-invalid={!!errors.capacity}
              onChange={(e) => update({ capacity: e.target.value.replace(/\D/g, "") })} />
          </Field>
          <Toggle id="waitlist" checked={form.waitlist_enabled} onChange={(waitlist_enabled) => update({ waitlist_enabled })}
            label="Waitlist" description="When the event is full, let people join a waitlist." />
          <Field label="Registration deadline" htmlFor="registration_deadline" hint="Optional. Defaults to the event start." error={errors.registration_deadline}>
            <Input id="registration_deadline" type="datetime-local" value={form.registration_deadline} aria-invalid={!!errors.registration_deadline}
              onChange={(e) => update({ registration_deadline: e.target.value })} />
          </Field>
        </div>
      )}
    </div>
  );
}
