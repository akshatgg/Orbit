"use client";

import { useId, useState, type ReactNode } from "react";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Field, Input } from "@/components/ui/Field";
import { CAREER_INTERESTS, DAY_PARTS, EVENT_FORMATS, PERSONAL_INTERESTS, UNIVERSITIES, WEEKDAYS } from "@/lib/taxonomy";
import { GOALS, HOST_ROLE_SUGGESTIONS, normalizeGoals, type Goal } from "@/lib/profile/flow";
import { FIELDS_BY_TYPE, USER_TYPES } from "@/lib/profile/user-type";
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
        {aside && <span className="shrink-0 text-xs text-subtle">{aside}</span>}
      </div>
      {hint && <p className="-mt-1.5 text-xs text-muted">{hint}</p>}
      {children}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </fieldset>
  );
}

const OTHER = "__other";

/** Large tappable card used for the goal and user-type choices. */
function ChoiceCard({ selected, onClick, emoji, title, hint, check = "circle", className = "" }: {
  selected: boolean; onClick: () => void; emoji: string; title: string; hint: string; check?: "circle" | "none"; className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3.5 rounded-[20px] p-3.5 text-left transition duration-200 ease-out active:scale-[0.985] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected ? "is-selected" : "glass hover:bg-ink/[0.08]"
      } ${className}`}
    >
      <span
        aria-hidden
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl transition-colors ${
          selected ? "bg-ink/[0.14]" : "bg-ink/[0.07]"
        }`}
      >
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug text-fg">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">{hint}</span>
      </span>
      {check === "circle" && (
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
            selected ? "bg-gradient border-transparent text-bg" : "border-ink/15 text-transparent"
          }`}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        </span>
      )}
    </button>
  );
}

/** "What brings you to ORBIT?": pick one or more goals. */
export function GoalsStep({ draft, update, errors }: StepProps) {
  function toggle(goal: Goal) {
    const goals = draft.goals.includes(goal) ? draft.goals.filter((g) => g !== goal) : [...draft.goals, goal];
    update({ goals: normalizeGoals(goals) });
  }
  return (
    <fieldset className="space-y-2.5">
      <legend className="sr-only">What brings you to ORBIT?</legend>
      {GOALS.map((g) => (
        <ChoiceCard
          key={g.value}
          selected={draft.goals.includes(g.value)}
          onClick={() => toggle(g.value)}
          emoji={g.emoji}
          title={g.title}
          hint={g.hint}
        />
      ))}
      {errors.goals && <p role="alert" className="pt-1 text-xs text-red-300">{errors.goals}</p>}
    </fieldset>
  );
}

export function NameField({ draft, update, errors }: StepProps) {
  const id = useId();
  return (
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
  );
}

function UniversityField({ draft, update, errors }: StepProps) {
  const known = (UNIVERSITIES as readonly string[]).includes(draft.university);
  const [choice, setChoice] = useState(known ? draft.university : draft.university ? OTHER : "");
  const [otherName, setOtherName] = useState(known ? "" : draft.university);
  return (
    <ChoiceSection legend={<>University<span className="ml-0.5 text-accent">*</span></>} error={errors.university}>
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
  );
}

/** "Which describes you?" plus the follow-up fields for the chosen type. */
export function UserTypeFields({ draft, update, errors }: StepProps) {
  const id = useId();
  const type = draft.user_type;
  const props = { draft, update, errors };
  return (
    <div className="space-y-6">
      <fieldset className="space-y-2.5">
        <legend className="mb-1 text-sm font-medium text-fg">Which describes you?<span className="ml-0.5 text-accent">*</span></legend>
        <div className="grid grid-cols-2 gap-2.5">
          {USER_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={type === t.value}
              onClick={() => update({ user_type: t.value })}
              className={`flex min-h-[5.25rem] flex-col items-start justify-between rounded-[20px] p-3.5 text-left transition duration-200 ease-out active:scale-[0.985] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                type === t.value ? "is-selected" : "glass hover:bg-ink/[0.08]"
              }`}
            >
              <span aria-hidden className="text-xl">{t.emoji}</span>
              <span className="text-[14px] font-semibold leading-tight text-fg">{t.label}</span>
            </button>
          ))}
        </div>
        {type === "professional" && (
          <p className="text-xs text-muted">Recruiters and employers: this is you.</p>
        )}
        {errors.user_type && <p role="alert" className="text-xs text-red-300">{errors.user_type}</p>}
      </fieldset>

      {type && FIELDS_BY_TYPE[type].length > 0 && (
        <div key={type} className="space-y-6 transition duration-300 ease-out starting:translate-y-2 starting:opacity-0">
          {(type === "student" || type === "graduate") && <UniversityField {...props} />}

          {type === "student" && (
            <>
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
            </>
          )}

          {type === "graduate" && (
            <Field label="Graduation year" htmlFor={`${id}-grad`} error={errors.graduation_year} required>
              <Input
                id={`${id}-grad`}
                value={draft.graduation_year}
                onChange={(e) => update({ graduation_year: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                inputMode="numeric"
                placeholder="e.g. 2024"
                maxLength={4}
                aria-invalid={!!errors.graduation_year}
              />
            </Field>
          )}

          {type === "professional" && (
            <>
              <Field label="Company" htmlFor={`${id}-company`} hint="Optional" error={errors.company}>
                <Input id={`${id}-company`} value={draft.company} onChange={(e) => update({ company: e.target.value })}
                  autoComplete="organization" placeholder="Where do you work?" maxLength={120} />
              </Field>
              <Field label="Industry" htmlFor={`${id}-industry`} hint="Optional" error={errors.industry}>
                <Input id={`${id}-industry`} list={`${id}-industry-list`} value={draft.industry}
                  onChange={(e) => update({ industry: e.target.value })} placeholder="e.g. Consulting" maxLength={120} />
                <datalist id={`${id}-industry-list`}>
                  {CAREER_INTERESTS.map((c) => <option key={c.value} value={c.label} />)}
                </datalist>
              </Field>
              <Field label="Job title" htmlFor={`${id}-title`} hint="Optional" error={errors.job_title}>
                <Input id={`${id}-title`} value={draft.job_title} onChange={(e) => update({ job_title: e.target.value })}
                  autoComplete="organization-title" placeholder="e.g. Talent Acquisition Lead" maxLength={120} />
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Explorer "Which describes you?" screen: name first, then the type picker. */
export function DescribeStep(props: StepProps) {
  return (
    <div className="space-y-7">
      <NameField {...props} />
      <UserTypeFields {...props} />
    </div>
  );
}

/** Role in the organisation: free text with suggestion chips. */
export function HostRoleField({ draft, update, errors }: StepProps) {
  const id = useId();
  return (
    <div className="space-y-2.5">
      <Field label="Your role" htmlFor={`${id}-role`} error={errors.host_role} required>
        <Input
          id={`${id}-role`}
          value={draft.host_role}
          onChange={(e) => update({ host_role: e.target.value })}
          placeholder="e.g. Society president"
          autoComplete="organization-title"
          maxLength={80}
          aria-invalid={!!errors.host_role}
        />
      </Field>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Role suggestions">
        {HOST_ROLE_SUGGESTIONS.map((r) => {
          const on = draft.host_role.trim().toLowerCase() === r.toLowerCase();
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => update({ host_role: r })}
              className={`rounded-full border px-3 py-1 text-xs transition duration-200 active:scale-[0.97] motion-reduce:transition-none ${
                on ? "bg-gradient border-transparent font-medium text-bg" : "border-ink/10 bg-ink/[0.045] text-muted hover:border-ink/20 hover:text-fg"
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Host-only "About you": name and role. */
export function AboutStep(props: StepProps) {
  return (
    <div className="space-y-7">
      <NameField {...props} />
      <HostRoleField {...props} />
    </div>
  );
}

const picked = (n: number) => (n ? `${n} selected` : undefined);

/** Career and personal interests on one screen. */
export function InterestsStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-8">
      <ChoiceSection
        legend="Career"
        hint="Employer sessions, panels and workshops in these areas rank higher."
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
      <ChoiceSection
        legend="Outside work"
        hint="Socials, sport and society events you'd actually go to."
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
    </div>
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
                <p className="font-display text-xs font-medium text-muted">{g.label}</p>
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
            className="rounded-full border border-dashed border-ink/15 px-3 py-1 text-xs text-muted transition-colors hover:border-accent/50 hover:text-fg"
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
                    on ? "bg-gradient border-transparent" : "border-ink/10 bg-ink/[0.045] hover:border-ink/25"
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
