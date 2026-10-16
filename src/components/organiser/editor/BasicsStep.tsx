"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ImageUpload } from "../ImageUpload";
import { Counter, StepIntro, type StepProps } from "./fields";
import { TagPicker } from "./TagPicker";

export type CategoryOption = { id: string; name: string; group: string };

const GROUPS = [
  { value: "career", label: "Career" },
  { value: "social", label: "Social & community" },
  { value: "other", label: "Other interests" },
];

export function BasicsStep({ form, update, errors, categories }: StepProps & { categories: CategoryOption[] }) {
  return (
    <div className="space-y-5">
      <StepIntro title="The basics">What&apos;s happening, and why should people come?</StepIntro>

      <ImageUpload
        bucket="event-covers"
        label="Cover image"
        hint="16:9 works best · under 5 MB"
        value={form.cover_url}
        onChange={(cover_url) => update({ cover_url })}
      />

      <Field label={<span className="inline-flex w-[calc(100%-1rem)] justify-between">Title <Counter value={form.title} max={140} /></span>} htmlFor="title" required error={errors.title}>
        <Input
          id="title" value={form.title} maxLength={140} autoFocus aria-invalid={!!errors.title}
          placeholder="e.g. Case Interview Bootcamp" onChange={(e) => update({ title: e.target.value })}
        />
      </Field>

      <Field
        label={<span className="inline-flex w-[calc(100%-1rem)] justify-between">Summary <Counter value={form.summary} max={200} /></span>}
        htmlFor="summary"
        hint="One line shown on event cards."
        error={errors.summary}
      >
        <Textarea
          id="summary" value={form.summary} maxLength={200} rows={2} className="min-h-0" aria-invalid={!!errors.summary}
          placeholder="Crack your first case with ex-MBB consultants." onChange={(e) => update({ summary: e.target.value })}
        />
      </Field>

      <Field label="Description" htmlFor="description" hint="Agenda, speakers, who it's for, what to bring." error={errors.description}>
        <Textarea
          id="description" value={form.description} maxLength={5000} rows={7} aria-invalid={!!errors.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>

      <Field label="Category" htmlFor="category" error={errors.category_id}>
        <Select id="category" value={form.category_id} onChange={(e) => update({ category_id: e.target.value })}>
          <option value="">Choose a category…</option>
          {GROUPS.map((g) => (
            <optgroup key={g.value} label={g.label}>
              {categories.filter((c) => c.group === g.value).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      <div className="space-y-1.5">
        <p className="text-sm font-medium" id="tags-label">Tags</p>
        <TagPicker value={form.tags} onChange={(tags) => update({ tags })} error={errors.tags} />
      </div>
    </div>
  );
}
