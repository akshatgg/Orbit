"use client";

import { useId, useState, type ReactNode } from "react";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Field, Input } from "@/components/ui/Field";
import { CAREER_INTERESTS, DAY_PARTS, EVENT_FORMATS, PERSONAL_INTERESTS, UNIVERSITIES, WEEKDAYS } from "@/lib/taxonomy";
import { COURSE_SUGGESTIONS, DEPARTMENT_SUGGESTIONS, yearOptions } from "@/lib/profile/options";
import { countSlots, hasSlot, toggleSlot, withSlots, type Weekday } from "@/lib/profile/availability";
import type { ProfileDraft } from "@/lib/profile/schema";

export type CategoryOption = { slug: string; name: string; group: string };

export type StepProps = {
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  errors: Record<string, string>;
};

/** Labelled group of controls (fieldset + legend) with an optional hint and error. */
export function ChoiceSection({ legend, hint, error, children, aside }: {
  legend: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; aside?: ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <legend className="text-sm font-medium text-fg">{legend}</legend>
        {aside && <span className="shrink-0 text-xs text-muted">{aside}</span>}
      </div>
      {hint && <p className="-mt-1.5 text-xs text-muted">{hint}</p>}
      {children}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </fieldset>
  );
}

const OTHER = "__other";

export function BasicsStep({ draft, update, errors }: StepProps) {
  const id = useId();
  const known = (UNIVERSITIES as readonly string[]).includes(draft.university);
  const [choice, setChoice] = useState(known ? draft.university : draft.university ? OTHER : "");
  const [otherName, setOtherName] = useState(known ? "" : draft.university);

  return (
    <div className="space-y-6">
      <Field label="Your name" htmlFor={`${id}-name`} error={errors.full_name} required>
        <Input
          id={`${id}-name`}
          value={draft.full_name}
          onChange={(e) => update({ full_name: e.target.value })}
          autoComplete="name"
          placeholder="First and last name"
          aria-invalid={!!errors.full_name}
          maxLength={80}
        />
      </Field>

      <ChoiceSection legend={<>University<span className="ml-0.5 text-orange">*</span></>} error={errors.university}>
        <ChipGroup
          name="university_choice"
          multiple={false}
          defaultValue={choice ? [choice] : []}
          options={[...UNIVERSITIES.map((u) => ({ value: u, label: u })), { value: OTHER, label: "Other" }]}
          onChange={([v = ""]) => {
            setChoice(v);
            update({ university: v === OTHER ? otherName : v });
          }}
        />
        {choice === OTHER && (
          <Input
            aria-label="Your university"
            value={otherName}
            autoFocus
            placeholder="Which university?"
            maxLength={120}
            onChange={(e) => {
              setOtherName(e.target.value);
              update({ university: e.target.value });
            }}
          />
        )}
      </ChoiceSection>

      <Field label="Department" htmlFor={`${id}-dept`} error={errors.department}>
        <Input
          id={`${id}-dept`}
          list={`${id}-dept-list`}
          value={draft.department}
          onChange={(e) => update({ department: e.target.value })}
          placeholder="e.g. Business School"
          maxLength={120}
        />
        <datalist id={`${id}-dept-list`}>
          {DEPARTMENT_SUGGESTIONS.map((d) => <option key={d} value={d} />)}
        </datalist>
      </Field>

      <Field label="Course" htmlFor={`${id}-course`} error={errors.course}>
        <Input
          id={`${id}-course`}
          list={`${id}-course-list`}
          value={draft.course}
          onChange={(e) => update({ course: e.target.value })}
          placeholder="e.g. MSc Management"
          maxLength={120}
        />
        <datalist id={`${id}-course-list`}>
          {COURSE_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
        </datalist>
      </Field>

      <ChoiceSection legend="Year of study" error={errors.year_of_study}>
        <ChipGroup
          name="year_of_study"
          multiple={false}
          defaultValue={draft.year_of_study ? [draft.year_of_study] : []}
          options={yearOptions(draft.year_of_study)}
          onChange={([v = ""]) => update({ year_of_study: v })}
        />
      </ChoiceSection>
    </div>
  );
}

const picked = (n: number) => (n ? `${n} selected` : undefined);

export function CareerStep({ draft, update, errors }: StepProps) {
  return (
    <ChoiceSection
      legend="Career interests"
      hint="Pick at least one. Employer sessions, panels and workshops in these areas rank higher."
      error={errors.career_interests}
      aside={picked(draft.career_interests.length)}
    >
      <ChipGroup
        name="career_interests"
        options={[...CAREER_INTERESTS]}
        defaultValue={draft.career_interests}
        onChange={(v) => update({ career_interests: v })}
      />
    </ChoiceSection>
  );
}

export function PersonalStep({ draft, update, errors }: StepProps) {
  return (
    <ChoiceSection
      legend="Personal interests"
      hint="Socials, sport and society events you'd actually go to. Optional."
      error={errors.personal_interests}
      aside={picked(draft.personal_interests.length)}
    >
      <ChipGroup
        name="personal_interests"
        options={[...PERSONAL_INTERESTS]}
        defaultValue={draft.personal_interests}
        onChange={(v) => update({ personal_interests: v })}
      />
    </ChoiceSection>
  );
}

const GROUPS = [
  { value: "career", label: "Career" },
  { value: "social", label: "Social" },
  { value: "other", label: "Other" },
] as const;

export function EventsStep({ draft, update, errors, categories }: StepProps & { categories: CategoryOption[] }) {
  const id = useId();
  return (
    <div className="space-y-7">
      <ChoiceSection
        legend="Event types"
        hint="Optional. We'll still show you anything that's a strong match."
        error={errors.preferred_categories}
        aside={picked(draft.preferred_categories.length)}
      >
        <div className="space-y-4">
          {GROUPS.map((g) => {
            const options = categories.filter((c) => c.group === g.value);
            if (!options.length) return null;
            const slugs = new Set(options.map((o) => o.slug));
            return (
              <div key={g.value} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{g.label}</p>
                <ChipGroup
                  name="preferred_categories"
                  options={options.map((o) => ({ value: o.slug, label: o.name }))}
                  defaultValue={draft.preferred_categories.filter((s) => slugs.has(s))}
                  onChange={(v) =>
                    update({ preferred_categories: [...draft.preferred_categories.filter((s) => !slugs.has(s)), ...v] })
                  }
                />
              </div>
            );
          })}
        </div>
      </ChoiceSection>

      <ChoiceSection legend="Formats" hint="Leave blank if you're happy with any." error={errors.preferred_formats}>
        <ChipGroup
          name="preferred_formats"
          options={[...EVENT_FORMATS]}
          defaultValue={draft.preferred_formats}
          onChange={(v) => update({ preferred_formats: v })}
        />
      </ChoiceSection>

      <Field label="Where are you based?" htmlFor={`${id}-loc`} hint="City or area, for in-person events." error={errors.location_preference}>
        <Input
          id={`${id}-loc`}
          value={draft.location_preference}
          onChange={(e) => update({ location_preference: e.target.value })}
          placeholder="London"
          autoComplete="address-level2"
          maxLength={80}
        />
      </Field>
    </div>
  );
}

const WEEKDAY_VALUES = WEEKDAYS.map((d) => d.value) as Weekday[];
const PRESETS = [
  { label: "Weekday evenings", days: WEEKDAY_VALUES.slice(0, 5), parts: ["evening"] as const },
  { label: "Weekends", days: WEEKDAY_VALUES.slice(5), parts: ["morning", "day", "evening"] as const },
  { label: "Lunchtimes", days: WEEKDAY_VALUES.slice(0, 5), parts: ["day"] as const },
];

export function AvailabilityStep({ draft, update }: StepProps) {
  const a = draft.availability;
  const n = countSlots(a);
  return (
    <ChoiceSection
      legend="Weekly availability"
      hint="Tap the times you're usually free. We'll favour events that fit."
      aside={n ? `${n} slot${n === 1 ? "" : "s"}` : undefined}
    >
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => update({ availability: withSlots(a, p.days, p.parts) })}
            className="rounded-full border border-dashed border-line px-3 py-1 text-xs text-muted transition-colors hover:border-violet/60 hover:text-fg"
          >
            + {p.label}
          </button>
        ))}
        {n > 0 && (
          <button
            type="button"
            onClick={() => update({ availability: {} })}
            className="rounded-full px-3 py-1 text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div role="group" aria-label="Weekly availability grid" className="grid grid-cols-[4.75rem_repeat(7,minmax(0,1fr))] gap-1.5">
        <div aria-hidden className="contents">
          <span />
          {WEEKDAYS.map((d) => (
            <span key={d.value} className="pb-1 text-center text-[11px] font-medium text-muted">
              {d.label}
            </span>
          ))}
        </div>
        {DAY_PARTS.map((part) => (
          <div key={part.value} className="contents">
            <span aria-hidden className="flex items-center text-xs text-muted">{part.label}</span>
            {WEEKDAYS.map((d) => {
              const on = hasSlot(a, d.value, part.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${d.label} ${part.label.toLowerCase()}`}
                  onClick={() => update({ availability: toggleSlot(a, d.value, part.value) })}
                  className={`aspect-square rounded-lg border transition-all active:scale-90 ${
                    on ? "border-transparent bg-gradient shadow-[0_0_18px_-4px_rgb(181_124_246/0.7)]" : "border-line bg-surface hover:border-violet/50"
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </ChoiceSection>
  );
}
