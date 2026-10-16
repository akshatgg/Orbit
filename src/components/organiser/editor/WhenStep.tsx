"use client";

import { Field, Input, Textarea } from "@/components/ui/Field";
import { londonZoneLabel } from "@/lib/organiser/time";
import { Segmented, StepIntro, type StepProps } from "./fields";

const FORMATS = [
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export function WhenStep({ form, update, errors }: StepProps) {
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
